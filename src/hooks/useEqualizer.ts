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
  const bypassGainNodeRef = useRef<GainNode | null>(null);

  // État de l'égaliseur - maintenant avec enabled: true par défaut
  const [settings, setSettings] = useState<EqualizerSettings>(() => {
    const saved = localStorage.getItem('equalizerSettings');
    if (saved) {
      const parsedSettings = JSON.parse(saved);
      // S'assurer que enabled est true si pas défini
      return {
        ...parsedSettings,
        enabled: parsedSettings.enabled !== false
      };
    }
    return DEFAULT_PRESETS[0].settings;
  });

  const [currentPreset, setCurrentPreset] = useState<string | null>(() => {
    return localStorage.getItem('currentEqualizerPreset') || 'Flat';
  });

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

      // Créer le gain node pour le préamplificateur
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.gain.value = Math.pow(10, settings.preAmp / 20);

      // Créer un gain node pour le bypass
      bypassGainNodeRef.current = audioContext.createGain();
      bypassGainNodeRef.current.gain.value = 1;

      // Créer les filtres pour chaque bande
      filtersRef.current = settings.bands.map((band, index) => {
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

      // Connecter le bypass gain node
      currentNode.connect(bypassGainNodeRef.current);
      currentNode = bypassGainNodeRef.current;

      // Connecter à la destination finale
      currentNode.connect(audioContext.destination);

      setIsInitialized(true);
      console.log('Égaliseur initialisé avec succès, enabled:', settings.enabled);
      
      // S'assurer que l'égaliseur est activé après l'initialisation
      if (!settings.enabled) {
        console.log('Activation automatique de l\'égaliseur après initialisation');
        setSettings(prev => {
          const newSettings = { ...prev, enabled: true };
          localStorage.setItem('equalizerSettings', JSON.stringify(newSettings));
          return newSettings;
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'égaliseur:', error);
    }
  }, [audioElement, isInitialized, settings.preAmp, settings.enabled, settings.bands]);

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
      if (filtersRef.current[index]) {
        filtersRef.current[index].gain.value = preset.settings.enabled ? band.gain : 0;
      }
    });

    // Mettre à jour le gain
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = Math.pow(10, preset.settings.preAmp / 20);
    }

    setSettings(preset.settings);
    setCurrentPreset(presetName);
    localStorage.setItem('equalizerSettings', JSON.stringify(preset.settings));
    localStorage.setItem('currentEqualizerPreset', presetName);
  }, []);

  // Activer/désactiver l'égaliseur
  const toggleEnabled = useCallback(() => {
    setSettings(prev => {
      const newEnabled = !prev.enabled;
      console.log(`Égaliseur ${newEnabled ? 'activé' : 'désactivé'}`);
      
      // Appliquer immédiatement les changements aux filtres
      if (filtersRef.current.length > 0) {
        filtersRef.current.forEach((filter, index) => {
          const targetGain = newEnabled ? prev.bands[index].gain : 0;
          filter.gain.value = targetGain;
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

  // Mettre à jour le préamplificateur
  const setPreAmp = useCallback((gain: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = Math.pow(10, gain / 20);
      console.log(`PreAmp mis à jour: ${gain}dB`);
    }

    setSettings(prev => {
      const newSettings = { ...prev, preAmp: gain };
      localStorage.setItem('equalizerSettings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

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
