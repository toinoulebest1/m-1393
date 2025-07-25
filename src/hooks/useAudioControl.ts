import { useCallback } from 'react';
import { getAudioFileUrl } from '@/utils/storage';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';
import { Song } from '@/types/player';
// import { isInCache, getFromCache, addToCache } from '@/utils/audioCache'; // DÉSACTIVÉ
// import { memoryCache } from '@/utils/memoryCache'; // DÉSACTIVÉ
import { AutoplayManager } from '@/utils/autoplayManager';

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

  const play = useCallback(async (song?: Song) => {
    if (isChangingSong) {
      console.log("🚫 Changement déjà en cours, ignoré");
      return;
    }
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      setIsChangingSong(true);
      
      console.log("🎵 === LECTURE ULTRA-INSTANTANÉE ===");
      console.log("🎶 Chanson:", song.title, "par", song.artist);
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      // MediaSession en arrière-plan immédiat
      if ('mediaSession' in navigator) {
        setTimeout(() => updateMediaSessionMetadata(song), 0);
      }

      try {
        console.log("⚡ Configuration audio ultra-rapide");
        const audio = audioRef.current;
        audio.crossOrigin = "anonymous";
        audio.volume = volume / 100;
        
        console.log("🚀 Récupération URL instantanée...");
        const startTime = performance.now();
        
        // Cache IndexedDB DÉSACTIVÉ
        console.log("🚀 Récupération directe depuis les liens pré-générés...");
        
        // Récupération réseau directe
        const networkPromise = getAudioFileUrl(song.url).then(url => {
          if (typeof url === 'string') {
            return { url, fromCache: false };
          }
          throw new Error('URL invalide');
        }).catch(error => {
          console.error("❌ Erreur récupération réseau:", error.message);
          
          // Gestion spécifique des erreurs
          if (error.message.includes('OneDrive') || error.message.includes('jeton')) {
            throw new Error('OneDrive non configuré ou jeton expiré. Veuillez configurer OneDrive dans les paramètres.');
          }
          
          if (error.message.includes('not found') || error.message.includes('File not found')) {
            throw new Error(`Fichier audio introuvable: ${song.title}. Le fichier a peut-être été supprimé du stockage.`);
          }
          
          throw error;
        });
        
        // Prendre directement l'URL réseau
        const audioData = await networkPromise;
        
        const audioUrl = audioData.url;
        const elapsed = performance.now() - startTime;
        
        console.log("✅ URL en:", elapsed.toFixed(1), "ms", "(réseau direct)");

        if (!audioUrl || typeof audioUrl !== 'string') {
          throw new Error('URL audio non disponible');
        }

        // Cache mémoire et IndexedDB DÉSACTIVÉS

        // Configuration streaming ultra-agressive
        console.log("⚡ Streaming instantané");
        audio.preload = "metadata"; // Plus léger que "auto"
        audio.src = audioUrl;
        
        // Forcer le chargement immédiat du début du fichier
        audio.load();
        
        // Démarrage avec gestion autoplay optimisée
        console.log("🚀 Play avec gestion autoplay...");
        const playStartTime = performance.now();
        
        const success = await AutoplayManager.playAudio(audio);
        
        if (success) {
          const playElapsed = performance.now() - playStartTime;
          const totalElapsed = performance.now() - startTime;
          
          console.log("✅ === SUCCÈS ULTRA-RAPIDE ===");
          console.log("🎵 Chanson:", song.title);
          console.log("⚡ Play:", playElapsed.toFixed(1), "ms");
          console.log("⚡ Total:", totalElapsed.toFixed(1), "ms");
          console.log("🎯 Perf:", totalElapsed < 100 ? "EXCELLENT" : totalElapsed < 200 ? "BON" : "LENT");
          
          setIsPlaying(true);
          
          // Préchargement DÉSACTIVÉ pour éviter les chargements multiples
          // setTimeout(() => preloadNextTracks(), 50);
          
          // Changement terminé ultra-rapide
          changeTimeoutRef.current = window.setTimeout(() => {
            setIsChangingSong(false);
            changeTimeoutRef.current = null;
          }, 25);
        } else {
          console.log("⚠️ Lecture en attente d'activation utilisateur");
          setIsChangingSong(false);
          
          // Afficher info navigateur si nécessaire
          const browserInfo = AutoplayManager.getBrowserInfo();
          if (!browserInfo.supportsAutoplay) {
            toast.info(`${browserInfo.name} bloque l'autoplay - cliquez pour activer`, {
              duration: 5000,
              position: "top-center"
            });
          }
        }
        
      } catch (error) {
        console.error("💥 Erreur récupération:", error);
        handlePlayError(error as any, song);
      }
    } else if (audioRef.current) {
      // Reprise avec gestion autoplay
      console.log("⚡ Reprise avec gestion autoplay");
      try {
        audioRef.current.volume = volume / 100;
        const success = await AutoplayManager.playAudio(audioRef.current);
        
        if (success) {
          console.log("✅ Reprise OK");
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
    
    if (error.name === 'NotAllowedError') {
      const browserInfo = AutoplayManager.getBrowserInfo();
      toast.error(`${browserInfo.name} bloque la lecture audio`, {
        description: "Cliquez sur le bouton d'activation qui va apparaître",
        duration: 5000,
        action: {
          label: "Info",
          onClick: () => {
            toast.info("Utilisez Firefox pour une expérience optimale sans restrictions d'autoplay", {
              duration: 8000
            });
          }
        }
      });
    } else if (error.message?.includes('OneDrive') || error.message?.includes('jeton')) {
      toast.error("Configuration OneDrive requise", {
        description: "OneDrive n'est pas configuré ou le jeton a expiré",
        duration: 8000,
        action: {
          label: "Configurer",
          onClick: () => {
            // Rediriger vers les paramètres OneDrive
            window.location.href = '/onedrive-settings';
          }
        }
      });
    } else if (error.message?.includes('Fichier audio introuvable') || error.message?.includes('not found')) {
      toast.error("Fichier audio introuvable", {
        description: `La chanson "${song?.title || 'inconnue'}" n'est plus disponible dans le stockage`,
        duration: 8000,
        action: {
          label: "Passer",
          onClick: () => {
            // Passer à la chanson suivante si possible
            console.log("Passage à la chanson suivante...");
          }
        }
      });
    } else {
      toast.error(`Erreur: ${error.message}`);
    }
    
    setIsPlaying(false);
    setIsChangingSong(false);
  }, [setIsPlaying, setIsChangingSong]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, [audioRef, setIsPlaying]);

  const updateVolume = useCallback((newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    return newVolume;
  }, [audioRef]);

  const updateProgress = useCallback((newProgress: number) => {
    if (audioRef.current) {
      const time = (newProgress / 100) * audioRef.current.duration;
      audioRef.current.currentTime = time;
    }
    return newProgress;
  }, [audioRef]);

  const updatePlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    return rate;
  }, [audioRef]);

  const stopCurrentSong = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      console.log("Chanson arrêtée immédiatement");
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
    return audioRef.current;
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