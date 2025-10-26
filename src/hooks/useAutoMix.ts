import { useState, useRef, useCallback, useEffect } from 'react';
import { Song } from '@/types/player';
import {
  analyzeAudio,
  AudioAnalysis,
  calculateCompatibilityScore,
  findBestTransitionPoint,
  calculateOptimalStretchRatio,
  TransitionPoint
} from '@/utils/audioAnalysis';

export interface AutoMixConfig {
  enabled: boolean;
  transitionDuration: number; // secondes (8-32 beats)
  maxStretch: number; // 0.06 = ±6%, max 0.10 = ±10%
  targetLUFS: number; // -14 LUFS
  eqSweepEnabled: boolean;
  filterEnabled: boolean;
  echoOutEnabled: boolean;
}

interface SongWithAnalysis {
  song: Song;
  analysis: AudioAnalysis;
}

export interface AutoMixTransition {
  outPoint: TransitionPoint;
  inPoint: TransitionPoint;
  duration: number;
  stretchRatio: number;
  compatibilityScore: number;
  effects: {
    crossfade: boolean;
    eqSweep: boolean;
    filter: boolean;
    echoOut: boolean;
  };
}

const DEFAULT_CONFIG: AutoMixConfig = {
  enabled: false,
  transitionDuration: 8, // 8 secondes par défaut
  maxStretch: 0.06,
  targetLUFS: -14,
  eqSweepEnabled: true,
  filterEnabled: true,
  echoOutEnabled: false
};

export const useAutoMix = () => {
  const [config, setConfig] = useState<AutoMixConfig>(DEFAULT_CONFIG);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
  // Cache des analyses audio
  const analysisCache = useRef<Map<string, AudioAnalysis>>(new Map());
  const currentTransition = useRef<AutoMixTransition | null>(null);
  
  // Contexts Web Audio pour traitement
  const audioContext = useRef<AudioContext | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const filterNode = useRef<BiquadFilterNode | null>(null);
  const eqNodes = useRef<BiquadFilterNode[]>([]);

  /**
   * Initialise le contexte Web Audio
   */
  const initAudioContext = useCallback(() => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Création des nodes d'effet
      gainNode.current = audioContext.current.createGain();
      filterNode.current = audioContext.current.createBiquadFilter();
      filterNode.current.type = 'lowpass';
      filterNode.current.frequency.value = 20000; // Bypass par défaut
      
      // EQ 3 bandes (low, mid, high)
      const frequencies = [100, 1000, 10000];
      eqNodes.current = frequencies.map(freq => {
        const eq = audioContext.current!.createBiquadFilter();
        eq.type = 'peaking';
        eq.frequency.value = freq;
        eq.Q.value = 1;
        eq.gain.value = 0;
        return eq;
      });
      
      console.log('✅ Auto-mix audio context initialized');
    }
    return audioContext.current;
  }, []);

  /**
   * Analyse une chanson et met en cache le résultat
   */
  const analyzeSong = useCallback(async (song: Song): Promise<AudioAnalysis> => {
    // Vérifier le cache
    if (analysisCache.current.has(song.id)) {
      console.log('📦 Using cached analysis for:', song.title);
      return analysisCache.current.get(song.id)!;
    }
    
    console.log('🎵 Analyzing song:', song.title);
    const analysis = await analyzeAudio(song.url);
    analysisCache.current.set(song.id, analysis);
    
    return analysis;
  }, []);

  /**
   * Analyse une playlist entière
   */
  const analyzePlaylist = useCallback(async (songs: Song[]): Promise<SongWithAnalysis[]> => {
    if (songs.length === 0) return [];
    
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    const results: SongWithAnalysis[] = [];
    
    for (let i = 0; i < songs.length; i++) {
      try {
        const analysis = await analyzeSong(songs[i]);
        results.push({ song: songs[i], analysis });
        setAnalysisProgress(((i + 1) / songs.length) * 100);
      } catch (error) {
        console.error('❌ Error analyzing song:', songs[i].title, error);
        // Continue avec valeurs par défaut
        results.push({
          song: songs[i],
          analysis: {
            bpm: 120,
            key: '8A',
            energy: 0.5,
            structure: { intro: null, outro: null, drops: [], breaks: [] },
            beatgrid: [],
            duration: 0
          }
        });
      }
    }
    
    setIsAnalyzing(false);
    setAnalysisProgress(100);
    
    console.log('✅ Playlist analysis complete:', results.length, 'songs');
    return results;
  }, [analyzeSong]);

  /**
   * Calcule la transition optimale entre deux chansons
   */
  const calculateTransition = useCallback(
    (currentSong: Song, nextSong: Song): AutoMixTransition | null => {
      const currentAnalysis = analysisCache.current.get(currentSong.id);
      const nextAnalysis = analysisCache.current.get(nextSong.id);
      
      if (!currentAnalysis || !nextAnalysis) {
        console.warn('⚠️ Missing analysis for transition calculation');
        return null;
      }
      
      // Trouver les meilleurs points de transition
      const outPoint = findBestTransitionPoint(currentAnalysis, 'mix-out');
      const inPoint = findBestTransitionPoint(nextAnalysis, 'mix-in');
      
      // Calculer le ratio de stretch optimal
      const stretchRatio = calculateOptimalStretchRatio(
        nextAnalysis.bpm,
        currentAnalysis.bpm,
        config.maxStretch
      );
      
      // Score de compatibilité
      const compatibilityScore = calculateCompatibilityScore(currentAnalysis, nextAnalysis);
      
      // Durée de transition en fonction du BPM
      const beatsInTransition = Math.ceil(config.transitionDuration * currentAnalysis.bpm / 60);
      const duration = (beatsInTransition * 60) / currentAnalysis.bpm;
      
      const transition: AutoMixTransition = {
        outPoint,
        inPoint,
        duration,
        stretchRatio,
        compatibilityScore,
        effects: {
          crossfade: true,
          eqSweep: config.eqSweepEnabled && compatibilityScore > 0.6,
          filter: config.filterEnabled && compatibilityScore > 0.5,
          echoOut: config.echoOutEnabled && outPoint.type === 'outro'
        }
      };
      
      console.log('🎚️ Calculated transition:', transition);
      currentTransition.current = transition;
      
      return transition;
    },
    [config]
  );

  /**
   * Applique la normalisation LUFS
   */
  const applyLUFSNormalization = useCallback((audioElement: HTMLAudioElement) => {
    if (!audioContext.current || !gainNode.current) return;
    
    try {
      const source = audioContext.current.createMediaElementSource(audioElement);
      
      // Calcul simple du gain (approximation LUFS)
      // Dans une vraie implémentation, on utiliserait un analyseur LUFS complet
      const targetGain = Math.pow(10, config.targetLUFS / 20);
      gainNode.current.gain.value = targetGain;
      
      source.connect(gainNode.current);
      gainNode.current.connect(audioContext.current.destination);
      
      console.log('🔊 LUFS normalization applied, target:', config.targetLUFS, 'dB');
    } catch (error) {
      // Source déjà connectée, on ignore
      console.log('Audio source already connected');
    }
  }, [config.targetLUFS]);

  /**
   * Applique un crossfade avec effets (EQ sweep, filter)
   */
  const applyCrossfadeWithEffects = useCallback(
    (
      currentAudio: HTMLAudioElement,
      nextAudio: HTMLAudioElement,
      transition: AutoMixTransition
    ) => {
      const ctx = initAudioContext();
      if (!ctx) return;
      
      const { duration, effects } = transition;
      const steps = 100;
      const intervalTime = (duration * 1000) / steps;
      
      let currentStep = 0;
      
      const crossfadeInterval = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        
        // Crossfade volumes
        const outVolume = 1 - progress;
        const inVolume = progress;
        
        currentAudio.volume = Math.max(0, outVolume);
        nextAudio.volume = Math.min(1, inVolume);
        
        // EQ Sweep (fade out high frequencies on outgoing track)
        if (effects.eqSweep && eqNodes.current.length > 0) {
          // High EQ (10kHz) - progressive cut
          eqNodes.current[2].gain.value = -12 * progress;
        }
        
        // Filter (lowpass on outgoing track)
        if (effects.filter && filterNode.current) {
          const minFreq = 200;
          const maxFreq = 20000;
          filterNode.current.frequency.value = maxFreq - (maxFreq - minFreq) * progress;
        }
        
        if (currentStep >= steps) {
          clearInterval(crossfadeInterval);
          console.log('✅ Crossfade complete');
          
          // Reset effects
          if (filterNode.current) {
            filterNode.current.frequency.value = 20000;
          }
          eqNodes.current.forEach(eq => eq.gain.value = 0);
        }
      }, intervalTime);
      
      return crossfadeInterval;
    },
    [initAudioContext]
  );

  /**
   * Prépare le prochain track avec time-stretch si nécessaire
   */
  const prepareNextTrack = useCallback(
    async (nextAudio: HTMLAudioElement, transition: AutoMixTransition) => {
      if (Math.abs(transition.stretchRatio - 1) < 0.01) {
        console.log('No time-stretch needed');
        return; // Pas besoin de stretch
      }
      
      console.log('⏱️ Applying time-stretch, ratio:', transition.stretchRatio);
      
      // Le time-stretch est appliqué via playbackRate
      // Note: Cela change le pitch, pour un vrai time-stretch sans pitch shift,
      // il faudrait utiliser une librairie comme Tone.js ou Web Audio API avancée
      nextAudio.playbackRate = transition.stretchRatio;
      
      // Dans une vraie implémentation, on utiliserait un algorithme de time-stretch
      // qui préserve le pitch (ex: PaulStretch, WSOLA)
    },
    []
  );

  /**
   * Active/désactive l'auto-mix
   */
  const toggleAutoMix = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, enabled }));
    if (enabled) {
      initAudioContext();
    }
    console.log('🎚️ Auto-mix', enabled ? 'enabled' : 'disabled');
  }, [initAudioContext]);

  /**
   * Met à jour la configuration
   */
  const updateConfig = useCallback((updates: Partial<AutoMixConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    console.log('⚙️ Auto-mix config updated:', updates);
  }, []);

  /**
   * Cleanup
   */
  useEffect(() => {
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  return {
    config,
    isAnalyzing,
    analysisProgress,
    toggleAutoMix,
    updateConfig,
    analyzeSong,
    analyzePlaylist,
    calculateTransition,
    applyCrossfadeWithEffects,
    prepareNextTrack,
    applyLUFSNormalization,
    getCurrentTransition: () => currentTransition.current,
    clearCache: () => analysisCache.current.clear()
  };
};
