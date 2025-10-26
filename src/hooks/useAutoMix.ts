import { useState, useCallback, useEffect, useRef } from 'react';
import { analyzeAudio, AudioAnalysis, calculateCompatibilityScore, findBestTransitionPoint } from '@/utils/audioAnalysis';

export type MixMode = 'fluide' | 'club' | 'radio' | 'energie';

export interface AutoMixConfig {
  enabled: boolean;
  mode: MixMode;
  transitionDuration: number;
  tempoStretch: boolean;
  eqEnabled: boolean;
  effectsEnabled: boolean;
}

export interface AutoMixTransition {
  startTime: number;
  duration: number;
  crossfadeType: 'linear' | 'exponential' | 'logarithmic';
  effects: {
    lowPass: boolean;
    highPass: boolean;
    echo: boolean;
    reverb: boolean;
  };
  eqCurve: {
    bassSwap: boolean;
    highCut: boolean;
    midBoost: boolean;
  };
}

export interface SongWithAnalysis {
  id: string;
  url: string;
  title: string;
  artist: string;
  analysis?: AudioAnalysis;
}

export function useAutoMix() {
  const [config, setConfig] = useState<AutoMixConfig>({
    enabled: false,
    mode: 'fluide',
    transitionDuration: 8,
    tempoStretch: true,
    eqEnabled: true,
    effectsEnabled: true,
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [currentTransition, setCurrentTransition] = useState<AutoMixTransition | null>(null);
  const [analyzedSongs, setAnalyzedSongs] = useState<Map<string, AudioAnalysis>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const analyzeSong = useCallback(async (song: SongWithAnalysis): Promise<AudioAnalysis> => {
    if (analyzedSongs.has(song.id)) {
      return analyzedSongs.get(song.id)!;
    }

    console.log(`[AutoMix] Analyzing song: ${song.title}`);
    const analysis = await analyzeAudio(song.url);
    
    setAnalyzedSongs(prev => new Map(prev).set(song.id, analysis));
    return analysis;
  }, [analyzedSongs]);

  const analyzePlaylist = useCallback(async (songs: SongWithAnalysis[]) => {
    setAnalyzing(true);
    console.log(`[AutoMix] Starting playlist analysis for ${songs.length} songs`);

    try {
      const analyses = await Promise.all(
        songs.slice(0, 10).map(song => analyzeSong(song))
      );
      
      console.log('[AutoMix] Playlist analysis complete');
      return analyses;
    } catch (error) {
      console.error('[AutoMix] Error analyzing playlist:', error);
      return [];
    } finally {
      setAnalyzing(false);
    }
  }, [analyzeSong]);

  const calculateTransition = useCallback((
    currentSong: SongWithAnalysis,
    nextSong: SongWithAnalysis,
    currentDuration: number
  ): AutoMixTransition | null => {
    const currentAnalysis = analyzedSongs.get(currentSong.id);
    const nextAnalysis = analyzedSongs.get(nextSong.id);

    if (!currentAnalysis || !nextAnalysis) {
      return null;
    }

    const compatibility = calculateCompatibilityScore(currentAnalysis, nextAnalysis);
    const transitionPoint = findBestTransitionPoint(currentAnalysis, nextAnalysis, currentDuration);

    const modeConfig = getModeConfig(config.mode);
    
    const transition: AutoMixTransition = {
      startTime: transitionPoint.start,
      duration: config.transitionDuration,
      crossfadeType: modeConfig.crossfadeType,
      effects: {
        lowPass: config.effectsEnabled && modeConfig.effects.includes('lowPass'),
        highPass: config.effectsEnabled && modeConfig.effects.includes('highPass'),
        echo: config.effectsEnabled && modeConfig.effects.includes('echo'),
        reverb: config.effectsEnabled && modeConfig.effects.includes('reverb'),
      },
      eqCurve: {
        bassSwap: config.eqEnabled && modeConfig.eqEnabled,
        highCut: config.eqEnabled && modeConfig.eqEnabled,
        midBoost: config.eqEnabled && modeConfig.eqEnabled,
      },
    };

    setCurrentTransition(transition);
    return transition;
  }, [config, analyzedSongs]);

  const applyLUFSNormalization = useCallback((audioBuffer: AudioBuffer, targetLUFS: number = -14): AudioBuffer => {
    const channelData = audioBuffer.getChannelData(0);
    let sum = 0;
    
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    
    const rms = Math.sqrt(sum / channelData.length);
    const currentLUFS = -23 + 20 * Math.log10(rms);
    const gainAdjustment = Math.pow(10, (targetLUFS - currentLUFS) / 20);
    
    const normalizedBuffer = audioContextRef.current!.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = normalizedBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i] * gainAdjustment;
      }
    }
    
    return normalizedBuffer;
  }, []);

  const applyCrossfadeWithEffects = useCallback((
    currentAudio: HTMLAudioElement,
    nextAudio: HTMLAudioElement,
    transition: AutoMixTransition
  ) => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const currentSource = ctx.createMediaElementSource(currentAudio);
    const nextSource = ctx.createMediaElementSource(nextAudio);
    
    const currentGain = ctx.createGain();
    const nextGain = ctx.createGain();
    
    currentSource.connect(currentGain);
    nextSource.connect(nextGain);
    
    if (transition.effects.lowPass) {
      const lowPassFilter = ctx.createBiquadFilter();
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.value = 800;
      currentGain.connect(lowPassFilter);
      lowPassFilter.connect(ctx.destination);
    } else {
      currentGain.connect(ctx.destination);
    }
    
    if (transition.effects.highPass) {
      const highPassFilter = ctx.createBiquadFilter();
      highPassFilter.type = 'highpass';
      highPassFilter.frequency.value = 200;
      nextGain.connect(highPassFilter);
      highPassFilter.connect(ctx.destination);
    } else {
      nextGain.connect(ctx.destination);
    }
    
    const now = ctx.currentTime;
    const duration = transition.duration;
    
    currentGain.gain.setValueAtTime(1, now);
    nextGain.gain.setValueAtTime(0, now);
    
    if (transition.crossfadeType === 'exponential') {
      currentGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      nextGain.gain.exponentialRampToValueAtTime(1, now + duration);
    } else {
      currentGain.gain.linearRampToValueAtTime(0, now + duration);
      nextGain.gain.linearRampToValueAtTime(1, now + duration);
    }
  }, []);

  const prepareNextTrack = useCallback(async (
    currentSong: SongWithAnalysis,
    nextSong: SongWithAnalysis,
    currentDuration: number
  ) => {
    if (!config.enabled) return null;

    const currentAnalysis = analyzedSongs.get(currentSong.id);
    const nextAnalysis = analyzedSongs.get(nextSong.id);

    if (!currentAnalysis || !nextAnalysis) {
      await analyzeSong(currentSong);
      await analyzeSong(nextSong);
    }

    return calculateTransition(currentSong, nextSong, currentDuration);
  }, [config.enabled, analyzedSongs, analyzeSong, calculateTransition]);

  const toggleAutoMix = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, enabled }));
  }, []);

  const updateConfig = useCallback((updates: Partial<AutoMixConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    config,
    analyzing,
    currentTransition,
    analyzedSongs,
    analyzeSong,
    analyzePlaylist,
    calculateTransition,
    prepareNextTrack,
    toggleAutoMix,
    updateConfig,
    applyLUFSNormalization,
    applyCrossfadeWithEffects,
  };
}

function getModeConfig(mode: MixMode) {
  const configs = {
    fluide: {
      crossfadeType: 'logarithmic' as const,
      effects: ['reverb'],
      eqEnabled: true,
      duration: 10,
    },
    club: {
      crossfadeType: 'exponential' as const,
      effects: ['lowPass', 'echo'],
      eqEnabled: true,
      duration: 6,
    },
    radio: {
      crossfadeType: 'linear' as const,
      effects: [],
      eqEnabled: false,
      duration: 4,
    },
    energie: {
      crossfadeType: 'exponential' as const,
      effects: ['highPass', 'echo'],
      eqEnabled: true,
      duration: 8,
    },
  };

  return configs[mode];
}
