
import { useState, useRef, useCallback, useEffect } from 'react';
import { EqualizerSettings, EqualizerPreset, DEFAULT_PRESETS } from '@/types/equalizer';

interface UseEqualizerProps {
  audioElement: HTMLAudioElement | null;
}

export const useEqualizer = ({ audioElement }: UseEqualizerProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // État de l'égaliseur
  const [settings, setSettings] = useState<EqualizerSettings>(() => {
    const saved = localStorage.getItem('equalizerSettings');
    if (saved) {
      return JSON.parse(saved);
    }
    return DEFAULT_PRESETS[0].settings;
  });

  const [currentPreset, setCurrentPreset] = useState<string | null>(() => {
    return localStorage.getItem('currentEqualizerPreset') || 'Flat';
  });

  // Fonction pour convertir le gain affiché en gain réel (avec offset de -12dB)
  const convertDisplayGainToActualGain = useCallback((displayGain: number): number => {
    // -12dB affiché = 0dB réel (gain = 1)
    // 0dB affiché = +12dB réel
    const actualGainDb = displayGain + 12;
    return actualGainDb === 0 ? 1 : Math.pow(10, actualGainDb / 20);
  }, []);

  // Initialisation de Web Audio API
  const initializeAudioContext = useCallback(async () => {
    if (!audioElement || isInitialized) return;

    try {
      // Créer le contexte audio avec fallback pour webkit
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported');
      }
      
      audioContextRef.current = new AudioContextClass();
      const audioContext = audioContextRef.current;

      // Créer le nœud source
      sourceNodeRef.current = audioContext.createMediaElementSource(audioElement);

      // Créer le gain node pour le préamplificateur avec la conversion
      gainNodeRef.current = audioContext.createGain();
      const actualPreAmpGain = convertDisplayGainToActualGain(settings.preAmp);
      gainNodeRef.current.gain.value = actualPreAmpGain;

      // Créer les filtres pour chaque bande
      filtersRef.current = settings.bands.map((band) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        filter.Q.value = band.Q || 1;
        filter.gain.value = settings.enabled ? band.gain : 0;
        return filter;
      });

      // Connecter la chaîne audio
      let currentNode: AudioNode = sourceNodeRef.current;
      
      // Connecter le gain node
      currentNode.connect(gainNodeRef.current);
      currentNode = gainNodeRef.current;

      // Connecter tous les filtres en série
      filtersRef.current.forEach(filter => {
        currentNode.connect(filter);
        currentNode = filter;
      });

      // Connecter à la destination finale
      currentNode.connect(audioContext.destination);

      setIsInitialized(true);
      console.log('Égaliseur initialisé avec préamp à', settings.preAmp, 'dB affiché =', actualPreAmpGain, 'gain réel');
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'égaliseur:', error);
    }
  }, [audioElement, isInitialized, settings.preAmp, settings.enabled, settings.bands, convertDisplayGainToActualGain]);

  // Mettre à jour une bande de fréquence
  const updateBand = useCallback((index: number, gain: number) => {
    if (filtersRef.current[index] && settings.enabled) {
      filtersRef.current[index].gain.value = gain;
      console.log(`Bande ${index} mise à jour: ${gain}dB`);
    }

    setSettings(prev => {
      const newSettings = {
        ...prev,
        bands: prev.bands.map((band, i) => 
          i === index ? { ...band, gain } : band
        )
      };
      localStorage.setItem('equalizerSettings', JSON.stringify(newSettings));
      return newSettings;
    });

    // Réinitialiser le preset actuel car l'utilisateur a modifié manuellement
    setCurrentPreset(null);
    localStorage.removeItem('currentEqualizerPreset');
  }, [settings.enabled]);

  // Appliquer un preset
  const applyPreset = useCallback((presetName: string) => {
    const preset = DEFAULT_PRESETS.find(p => p.name === presetName);
    if (!preset) return;

    console.log(`Application du preset: ${presetName}`);

    // Mettre à jour les filtres seulement si l'égaliseur est activé
    preset.settings.bands.forEach((band, index) => {
      if (filtersRef.current[index] && audioContextRef.current) {
        const targetGain = preset.settings.enabled ? band.gain : 0;
        filtersRef.current[index].gain.setValueAtTime(targetGain, audioContextRef.current.currentTime);
      }
    });

    // Mettre à jour le gain avec la conversion et transition douce
    if (gainNodeRef.current && audioContextRef.current) {
      const actualPreAmpGain = convertDisplayGainToActualGain(preset.settings.preAmp);
      gainNodeRef.current.gain.setValueAtTime(actualPreAmpGain, audioContextRef.current.currentTime);
      console.log(`PreAmp preset: ${preset.settings.preAmp}dB affiché = ${actualPreAmpGain} gain réel`);
    }

    setSettings(preset.settings);
    setCurrentPreset(presetName);
    localStorage.setItem('equalizerSettings', JSON.stringify(preset.settings));
    localStorage.setItem('currentEqualizerPreset', presetName);
  }, [convertDisplayGainToActualGain]);

  // Activer/désactiver l'égaliseur
  const toggleEnabled = useCallback(() => {
    setSettings(prev => {
      const newEnabled = !prev.enabled;
      console.log(`Égaliseur ${newEnabled ? 'activé' : 'désactivé'}`);
      
      // Appliquer immédiatement les changements aux filtres avec transition
      if (filtersRef.current.length > 0 && audioContextRef.current) {
        filtersRef.current.forEach((filter, index) => {
          const targetGain = newEnabled ? prev.bands[index].gain : 0;
          filter.gain.setValueAtTime(targetGain, audioContextRef.current!.currentTime);
          console.log(`Filtre ${index}: gain=${targetGain}dB`);
        });
      }

      const newSettings = { ...prev, enabled: newEnabled };
      localStorage.setItem('equalizerSettings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Réinitialiser l'égaliseur
  const resetEqualizer = useCallback(() => {
    console.log('Réinitialisation de l\'égaliseur');
    applyPreset('Flat');
  }, [applyPreset]);

  // Mettre à jour le préamplificateur avec conversion
  const setPreAmp = useCallback((displayGain: number) => {
    if (gainNodeRef.current && audioContextRef.current) {
      const actualGain = convertDisplayGainToActualGain(displayGain);
      gainNodeRef.current.gain.setValueAtTime(actualGain, audioContextRef.current.currentTime);
      console.log(`PreAmp mis à jour: ${displayGain}dB affiché = ${actualGain} gain réel`);
    }

    setSettings(prev => {
      const newSettings = { ...prev, preAmp: displayGain };
      localStorage.setItem('equalizerSettings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, [convertDisplayGainToActualGain]);

  // Initialiser quand l'élément audio change
  useEffect(() => {
    if (audioElement) {
      initializeAudioContext();
    }
  }, [audioElement, initializeAudioContext]);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    settings,
    presets: DEFAULT_PRESETS,
    currentPreset,
    isEnabled: settings.enabled,
    isInitialized,
    updateBand,
    applyPreset,
    toggleEnabled,
    resetEqualizer,
    setPreAmp,
    initializeAudioContext
  };
};
