
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

  // État de l'égaliseur - DÉSACTIVÉ par défaut pour éviter les problèmes de volume
  const [settings, setSettings] = useState<EqualizerSettings>(() => {
    const saved = localStorage.getItem('equalizerSettings');
    if (saved) {
      const parsedSettings = JSON.parse(saved);
      return {
        ...parsedSettings,
        // Force disabled par défaut pour éviter l'initialisation automatique
        enabled: false
      };
    }
    return {
      ...DEFAULT_PRESETS[0].settings,
      enabled: false, // Désactivé par défaut
      preAmp: -15 // PreAmp par défaut à -15dB
    };
  });

  const [currentPreset, setCurrentPreset] = useState<string | null>(() => {
    return localStorage.getItem('currentEqualizerPreset') || 'Flat';
  });

  // Initialisation MANUELLE de Web Audio API - uniquement sur demande explicite
  const initializeAudioContext = useCallback(async () => {
    if (!audioElement || isInitialized) return;

    try {
      console.log('Initialisation manuelle de l\'égaliseur...');
      
      // Créer le contexte audio avec fallback pour webkit
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported');
      }
      
      audioContextRef.current = new AudioContextClass();
      const audioContext = audioContextRef.current;

      // Créer le nœud source
      sourceNodeRef.current = audioContext.createMediaElementSource(audioElement);

      // Créer le gain node pour le préamplificateur - GAIN À 1 (neutre)
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.gain.value = 1; // Neutre

      // Créer un gain node pour le bypass avec gain à 1 (neutre)
      bypassGainNodeRef.current = audioContext.createGain();
      bypassGainNodeRef.current.gain.value = 1; // Neutre

      // Créer les filtres pour chaque bande - TOUS À 0 (neutre)
      filtersRef.current = settings.bands.map((band, index) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        filter.Q.value = band.Q || 1;
        filter.gain.value = 0; // Neutre
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
      console.log('Égaliseur initialisé en mode neutre (aucune amplification)');
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'égaliseur:', error);
    }
  }, [audioElement, isInitialized, settings.bands]);

  // Mettre à jour une bande de fréquence
  const updateBand = useCallback((index: number, gain: number) => {
    if (filtersRef.current[index] && settings.enabled && isInitialized) {
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
  }, [settings.enabled, isInitialized]);

  // Appliquer un preset
  const applyPreset = useCallback((presetName: string) => {
    const preset = DEFAULT_PRESETS.find(p => p.name === presetName);
    if (!preset || !isInitialized) return;

    console.log(`Application du preset: ${presetName}`);

    // Mettre à jour les filtres seulement si l'égaliseur est activé
    preset.settings.bands.forEach((band, index) => {
      if (filtersRef.current[index] && audioContextRef.current) {
        const targetGain = preset.settings.enabled ? band.gain : 0;
        filtersRef.current[index].gain.setValueAtTime(targetGain, audioContextRef.current.currentTime);
      }
    });

    // Mettre à jour le gain avec transition douce
    if (gainNodeRef.current && audioContextRef.current) {
      const preAmpValue = preset.settings.preAmp === 0 ? 1 : Math.pow(10, preset.settings.preAmp / 20);
      gainNodeRef.current.gain.setValueAtTime(preAmpValue, audioContextRef.current.currentTime);
    }

    setSettings(preset.settings);
    setCurrentPreset(presetName);
    localStorage.setItem('equalizerSettings', JSON.stringify(preset.settings));
    localStorage.setItem('currentEqualizerPreset', presetName);
  }, [isInitialized]);

  // Activer/désactiver l'égaliseur
  const toggleEnabled = useCallback(() => {
    setSettings(prev => {
      const newEnabled = !prev.enabled;
      console.log(`Égaliseur ${newEnabled ? 'activé' : 'désactivé'}`);
      
      // Si on active l'égaliseur et qu'il n'est pas initialisé, l'initialiser d'abord
      if (newEnabled && !isInitialized) {
        initializeAudioContext().then(() => {
          // Appliquer les réglages après initialisation
          setTimeout(() => {
            if (filtersRef.current.length > 0 && audioContextRef.current) {
              filtersRef.current.forEach((filter, index) => {
                const targetGain = prev.bands[index].gain;
                filter.gain.setValueAtTime(targetGain, audioContextRef.current!.currentTime);
                console.log(`Filtre ${index}: gain=${targetGain}dB`);
              });
            }
          }, 100);
        });
      }
      
      // Appliquer immédiatement les changements aux filtres si déjà initialisé
      if (isInitialized && filtersRef.current.length > 0 && audioContextRef.current) {
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
  }, [isInitialized, initializeAudioContext]);

  // Réinitialiser l'égaliseur
  const resetEqualizer = useCallback(() => {
    console.log('Réinitialisation de l\'égaliseur');
    applyPreset('Flat');
  }, [applyPreset]);

  // Mettre à jour le préamplificateur
  const setPreAmp = useCallback((gain: number) => {
    if (gainNodeRef.current && audioContextRef.current && isInitialized) {
      const preAmpValue = gain === 0 ? 1 : Math.pow(10, gain / 20);
      gainNodeRef.current.gain.setValueAtTime(preAmpValue, audioContextRef.current.currentTime);
      console.log(`PreAmp mis à jour: ${gain}dB = ${preAmpValue}`);
    }

    setSettings(prev => {
      const newSettings = { ...prev, preAmp: gain };
      localStorage.setItem('equalizerSettings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, [isInitialized]);

  // NE PAS initialiser automatiquement - seulement sur demande explicite
  // useEffect supprimé pour éviter l'initialisation automatique

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
