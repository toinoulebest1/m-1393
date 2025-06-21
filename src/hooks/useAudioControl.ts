import { useCallback, useEffect } from 'react';
import { getAudioFileUrl } from '@/utils/storage';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';
import { Song } from '@/types/player';
import { AutoplayManager } from '@/utils/autoplayManager';
import { InstantStreaming } from '@/utils/instantStreaming';

interface UseAudioControlProps {
  audioRef: React.MutableRefObject<HTMLAudioElement>;
  nextAudioRef: React.MutableRefObject<HTMLAudioElement>;
  currentSong: Song | null;
  setCurrentSong: (song: Song | null) => void;
  isChangingSong: boolean;
  setIsChangingSong: (value: boolean) => void;
  volume: number;
  setIsPlaying: (value: boolean) => void;
  changeTimeoutRef: React.MutableRefObject<number | null>;
  setNextSongPreloaded: (value: boolean) => void;
  preloadNextTracks: () => Promise<void>;
}

export const useAudioControl = ({
  audioRef,
  nextAudioRef,
  currentSong,
  setCurrentSong,
  isChangingSong,
  setIsChangingSong,
  volume,
  setIsPlaying,
  changeTimeoutRef,
  setNextSongPreloaded,
  preloadNextTracks
}: UseAudioControlProps) => {

  // S'assurer que l'élément audio est correctement initialisé et attaché au DOM
  useEffect(() => {
    const initializeAudio = () => {
      // Vérifier si l'audio est déjà dans le DOM
      let existingAudio = document.getElementById('main-audio-player') as HTMLAudioElement;
      
      if (!existingAudio) {
        console.log("🎵 Création de l'élément audio principal");
        
        // Créer un nouvel élément audio et l'ajouter au DOM
        const audio = document.createElement('audio');
        audio.id = 'main-audio-player';
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.style.display = 'none';
        
        // L'ajouter au DOM
        document.body.appendChild(audio);
        
        // Mettre à jour la référence
        audioRef.current = audio;
        existingAudio = audio;
      } else {
        // Utiliser l'élément existant
        audioRef.current = existingAudio;
      }
      
      // Configuration de base
      existingAudio.volume = volume / 100;
      
      console.log("✅ Élément audio principal initialisé:", existingAudio.id);
    };

    initializeAudio();
    
    // Nettoyage au démontage
    return () => {
      const audioElement = document.getElementById('main-audio-player');
      if (audioElement && audioElement.parentNode) {
        audioElement.parentNode.removeChild(audioElement);
        console.log("🧹 Élément audio principal nettoyé");
      }
    };
  }, [volume]);

  const play = useCallback(async (song?: Song) => {
    if (isChangingSong) {
      console.log("🚫 Changement déjà en cours, ignoré");
      return;
    }
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      setIsChangingSong(true);
      
      console.log("🎵 === LECTURE INSTANTANÉE OPTIMISÉE ===");
      console.log("🎶 Chanson:", song.title, "par", song.artist);
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      // MediaSession immédiat
      if ('mediaSession' in navigator) {
        setTimeout(() => updateMediaSessionMetadata(song), 0);
      }

      try {
        console.log("⚡ Configuration audio instantanée");
        const audio = audioRef.current;
        
        // S'assurer que l'élément audio est correctement configuré
        if (!audio) {
          console.error("❌ Élément audio non disponible");
          setIsChangingSong(false);
          return;
        }
        
        audio.crossOrigin = "anonymous";
        audio.volume = volume / 100;
        
        console.log("🚀 Streaming instantané optimisé...");
        const startTime = performance.now();
        
        // Utiliser le nouveau système de streaming instantané
        const audioUrl = await InstantStreaming.getInstantAudioUrl(song.url);
        
        const elapsed = performance.now() - startTime;
        console.log("✅ URL récupérée en:", elapsed.toFixed(1), "ms");

        if (!audioUrl || typeof audioUrl !== 'string') {
          throw new Error('URL audio non disponible');
        }

        // Configuration ultra-optimisée
        console.log("⚡ Configuration instantanée");
        audio.preload = "auto";
        audio.src = audioUrl;
        
        // Nettoyer les anciens listeners pour éviter les doublons
        audio.removeEventListener('loadstart', () => {});
        audio.removeEventListener('canplay', () => {});
        audio.removeEventListener('error', () => {});
        
        // Événements pour debug
        const handleLoadStart = () => console.log("📥 Début chargement audio");
        const handleCanPlay = () => console.log("✅ Audio prêt à jouer");
        const handleError = (e: Event) => {
          console.error("❌ Erreur audio element:", e);
          const error = audio.error;
          if (error) {
            console.error("❌ Détails erreur audio:", {
              code: error.code,
              message: error.message,
              MEDIA_ERR_ABORTED: error.MEDIA_ERR_ABORTED,
              MEDIA_ERR_NETWORK: error.MEDIA_ERR_NETWORK,
              MEDIA_ERR_DECODE: error.MEDIA_ERR_DECODE,
              MEDIA_ERR_SRC_NOT_SUPPORTED: error.MEDIA_ERR_SRC_NOT_SUPPORTED
            });
          }
        };
        
        audio.addEventListener('loadstart', handleLoadStart);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);
        
        // Démarrage ultra-rapide
        console.log("🚀 Démarrage instantané...");
        const playStartTime = performance.now();
        
        const success = await AutoplayManager.playAudio(audio);
        
        if (success) {
          const playElapsed = performance.now() - playStartTime;
          const totalElapsed = performance.now() - startTime;
          
          console.log("✅ === SUCCÈS INSTANTANÉ ===");
          console.log("🎵 Chanson:", song.title);
          console.log("⚡ Play:", playElapsed.toFixed(1), "ms");
          console.log("⚡ Total:", totalElapsed.toFixed(1), "ms");
          console.log("🎯 Perf:", totalElapsed < 30 ? "ULTRA-RAPIDE" : totalElapsed < 100 ? "RAPIDE" : "NORMAL");
          
          setIsPlaying(true);
          
          // Préchargement ultra-agressif différé
          setTimeout(() => preloadNextTracks(), 25);
          
          // Changement terminé instantané
          changeTimeoutRef.current = window.setTimeout(() => {
            setIsChangingSong(false);
            changeTimeoutRef.current = null;
          }, 5); // 5ms pour un effet vraiment instantané
          
        } else {
          console.log("⚠️ Lecture en attente d'activation utilisateur");
          setIsChangingSong(false);
          
          // Ne pas afficher de toast, l'AutoplayManager s'en occupe automatiquement
          console.log("🎵 Prompt d'activation sera affiché automatiquement");
        }
        
      } catch (error) {
        console.error("💥 Erreur streaming instantané:", error);
        handlePlayError(error as any, song);
      }
    } else if (audioRef.current) {
      // Reprise instantanée
      console.log("⚡ Reprise instantanée");
      try {
        const audio = audioRef.current;
        
        // Vérifier que l'élément audio est disponible
        if (!audio) {
          console.error("❌ Élément audio non disponible pour la reprise");
          return;
        }
        
        audio.volume = volume / 100;
        const success = await AutoplayManager.playAudio(audio);
        
        if (success) {
          console.log("✅ Reprise instantanée réussie");
          setIsPlaying(true);
        } else {
          console.log("⚠️ Reprise en attente d'activation");
        }
      } catch (error) {
        console.error("❌ Erreur reprise:", error);
        setIsPlaying(false);
      }
    }
  }, [audioRef, currentSong, isChangingSong, preloadNextTracks, setCurrentSong, setIsChangingSong, setIsPlaying, setNextSongPreloaded, volume]);

  const handlePlayError = useCallback((error: any, song: Song | null) => {
    console.error("❌ Erreur lecture:", error);
    
    // Gestion spécifique des erreurs d'autoplay - pas de toast si AutoplayManager gère
    if (error.name === 'NotAllowedError') {
      console.log("🎵 Erreur autoplay - AutoplayManager va gérer");
      // Pas de toast ici, l'AutoplayManager affiche déjà le prompt
    } else if (error.message?.includes('Timeout')) {
      toast.error("Connexion trop lente", {
        description: "Vérifiez votre connexion internet",
        duration: 4000
      });
    } else if (error.message?.includes('OneDrive') || error.message?.includes('jeton')) {
      toast.error("Configuration OneDrive requise", {
        description: "OneDrive n'est pas configuré correctement",
        duration: 5000
      });
    } else if (error.message?.includes('introuvable') || error.message?.includes('not found')) {
      toast.error("Fichier audio introuvable", {
        description: `"${song?.title || 'Chanson'}" n'est plus disponible`,
        duration: 5000
      });
    } else if (error.message?.includes('CORS') || error.message?.includes('Cross-Origin')) {
      toast.error("Erreur de streaming", {
        description: "Problème de configuration réseau",
        duration: 3000
      });
    } else {
      toast.error("Erreur de lecture", {
        description: "Impossible de lire cette chanson",
        duration: 3000
      });
    }
    
    setIsPlaying(false);
    setIsChangingSong(false);
  }, [setIsPlaying, setIsChangingSong]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      console.log("⏸️ Lecture mise en pause");
    }
    setIsPlaying(false);
  }, [audioRef, setIsPlaying]);

  const updateVolume = useCallback((newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
      console.log("🔊 Volume mis à jour:", newVolume);
    }
    return newVolume;
  }, [audioRef]);

  const updateProgress = useCallback((newProgress: number) => {
    if (audioRef.current) {
      const time = (newProgress / 100) * audioRef.current.duration;
      audioRef.current.currentTime = time;
      console.log("⏭️ Position mise à jour:", time);
    }
    return newProgress;
  }, [audioRef]);

  const updatePlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      console.log("⚡ Vitesse de lecture:", rate);
    }
    return rate;
  }, [audioRef]);

  const stopCurrentSong = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      console.log("⏹️ Chanson arrêtée immédiatement");
    }
  }, [audioRef]);

  const refreshCurrentSong = useCallback(async () => {
    if (!currentSong) return;
    
    const { supabase } = await import('@/integrations/supabase/client');
    
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', currentSong.id)
        .single();
      
      if (error) {
        console.error("Erreur refresh song:", error);
        return;
      }
      
      if (data) {
        const updatedSong: Song = {
          ...currentSong,
          title: data.title || currentSong.title,
          artist: data.artist || currentSong.artist,
          imageUrl: data.image_url || currentSong.imageUrl,
          genre: data.genre || currentSong.genre,
        };
        
        setCurrentSong(updatedSong);
        localStorage.setItem('currentSong', JSON.stringify(updatedSong));
        
        if ('mediaSession' in navigator) {
          updateMediaSessionMetadata(updatedSong);
        }
        
        console.log("Métadonnées mises à jour:", updatedSong.title);
      }
    } catch (error) {
      console.error("Erreur refreshCurrentSong:", error);
    }
  }, [currentSong, setCurrentSong]);

  const getCurrentAudioElement = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      console.warn("⚠️ Élément audio non disponible dans getCurrentAudioElement");
    }
    return audio;
  }, [audioRef]);

  return {
    play,
    pause,
    updateVolume,
    updateProgress,
    updatePlaybackRate,
    stopCurrentSong,
    refreshCurrentSong,
    getCurrentAudioElement
  };
};
