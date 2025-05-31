import { useCallback } from 'react';
import { getAudioFile } from '@/utils/storage';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';
import { Song } from '@/types/player';
import { isInCache, getFromCache, addToCache } from '@/utils/audioCache';

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
      console.log("🚫 Changement de chanson déjà en cours, ignorer l'appel");
      return;
    }
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      setIsChangingSong(true);
      
      console.log("🎵 === DÉBUT LECTURE NOUVELLE CHANSON ===");
      console.log("🎶 Chanson:", song.title, "par", song.artist);
      console.log("🆔 ID:", song.id);
      console.log("📁 Chemin:", song.url);
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      if ('mediaSession' in navigator) {
        updateMediaSessionMetadata(song);
      }

      try {
        console.log("🔍 Récupération du fichier audio...");
        const audioUrl = await getAudioFile(song.url);
        if (!audioUrl) {
          console.error("❌ Aucune URL audio retournée");
          throw new Error('Fichier audio non trouvé');
        }

        console.log("✅ URL audio récupérée:", audioUrl);
        console.log("🔗 Type d'URL:", audioUrl.startsWith('http') ? 'HTTP' : audioUrl.startsWith('blob:') ? 'Blob' : 'Autre');

        // Configuration de l'élément audio
        audioRef.current.crossOrigin = "anonymous";
        audioRef.current.src = audioUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.preload = "auto";
        
        console.log("⚙️ Configuration audio element terminée");
        console.log("🔊 Volume initial:", volume / 100);
        
        // Événements de debugging pour comprendre pourquoi ça reste à 0
        const debugEvents = () => {
          console.log("📊 === ÉTAT AUDIO ELEMENT ===");
          console.log("🔄 ReadyState:", audioRef.current.readyState);
          console.log("⏰ CurrentTime:", audioRef.current.currentTime);
          console.log("⏱️ Duration:", audioRef.current.duration);
          console.log("⏸️ Paused:", audioRef.current.paused);
          console.log("🔇 Muted:", audioRef.current.muted);
          console.log("🔊 Volume:", audioRef.current.volume);
          console.log("🌐 NetworkState:", audioRef.current.networkState);
          console.log("❌ Error:", audioRef.current.error);
          console.log("===============================");
        };

        // Ajouter des listeners temporaires pour le debug
        const onLoadStart = () => console.log("🚀 loadstart: Début du chargement");
        const onLoadedMetadata = () => {
          console.log("📋 loadedmetadata: Métadonnées chargées");
          debugEvents();
        };
        const onCanPlay = () => {
          console.log("▶️ canplay: Prêt à jouer");
          debugEvents();
        };
        const onCanPlayThrough = () => {
          console.log("🎯 canplaythrough: Peut jouer complètement");
          debugEvents();
        };
        const onTimeUpdate = () => {
          console.log("⏰ timeupdate: Temps actuel:", audioRef.current.currentTime);
        };
        const onError = (e: any) => {
          console.error("💥 Erreur audio:", e);
          console.error("💥 Détails erreur:", audioRef.current.error);
          debugEvents();
        };
        const onStalled = () => {
          console.warn("⚠️ stalled: Téléchargement bloqué");
          debugEvents();
        };
        const onSuspend = () => {
          console.warn("⏸️ suspend: Téléchargement suspendu");
          debugEvents();
        };
        const onProgress = () => {
          console.log("📈 progress: Chargement en cours");
          if (audioRef.current.buffered.length > 0) {
            console.log("📊 Buffered:", audioRef.current.buffered.end(0), "secondes");
          }
        };

        // Ajouter tous les listeners
        audioRef.current.addEventListener('loadstart', onLoadStart);
        audioRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
        audioRef.current.addEventListener('canplay', onCanPlay);
        audioRef.current.addEventListener('canplaythrough', onCanPlayThrough);
        audioRef.current.addEventListener('timeupdate', onTimeUpdate);
        audioRef.current.addEventListener('error', onError);
        audioRef.current.addEventListener('stalled', onStalled);
        audioRef.current.addEventListener('suspend', onSuspend);
        audioRef.current.addEventListener('progress', onProgress);

        // Fonction de nettoyage des listeners
        const cleanup = () => {
          audioRef.current?.removeEventListener('loadstart', onLoadStart);
          audioRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
          audioRef.current?.removeEventListener('canplay', onCanPlay);
          audioRef.current?.removeEventListener('canplaythrough', onCanPlayThrough);
          audioRef.current?.removeEventListener('timeupdate', onTimeUpdate);
          audioRef.current?.removeEventListener('error', onError);
          audioRef.current?.removeEventListener('stalled', onStalled);
          audioRef.current?.removeEventListener('suspend', onSuspend);
          audioRef.current?.removeEventListener('progress', onProgress);
        };

        audioRef.current.load();
        
        console.log("🔄 Load() appelé, état initial:");
        debugEvents();
        
        // Attendre un peu pour voir l'état après load
        setTimeout(() => {
          console.log("🕐 État après 1 seconde:");
          debugEvents();
        }, 1000);
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("✅ === LECTURE RÉUSSIE ===");
            console.log("🎵 Chanson:", song.title);
            console.log("🔊 Volume:", audioRef.current.volume);
            
            setIsPlaying(true);
            audioRef.current.volume = volume / 100;
            
            debugEvents();
            
            // Nettoyer les listeners après succès
            setTimeout(cleanup, 5000);
            
            setTimeout(() => preloadNextTracks(), 1000);
            
            changeTimeoutRef.current = window.setTimeout(() => {
              setIsChangingSong(false);
              changeTimeoutRef.current = null;
            }, 1200);
          }).catch(error => {
            console.error("❌ === ERREUR DE LECTURE ===");
            console.error("🔴 Type:", error.name);
            console.error("💬 Message:", error.message);
            console.error("🔍 Détails:", error);
            
            debugEvents();
            cleanup();
            
            // Gestion spécifique des erreurs
            if (error.name === 'NotAllowedError') {
              console.log("🔒 Erreur de permission - tentative sans interaction utilisateur");
              toast.error("Cliquez d'abord sur la page puis réessayez");
            } else if (error.name === 'NotSupportedError') {
              console.log("🚫 Format non supporté");
              toast.error("Format audio non supporté");
            } else if (error.name === 'NetworkError') {
              console.log("🌐 Erreur réseau");
              toast.error("Erreur réseau - fichier inaccessible");
            } else {
              toast.error(`Erreur de lecture: ${error.message}`);
            }
            
            setIsPlaying(false);
            setIsChangingSong(false);
          });
        }
      } catch (error) {
        console.error("💥 === ERREUR RÉCUPÉRATION FICHIER ===");
        console.error("🔴 Erreur:", error);
        console.error("💬 Message:", error instanceof Error ? error.message : 'Erreur inconnue');
        
        if (error instanceof Error) {
          if (error.message.includes('non trouvé') || error.message.includes('not found')) {
            toast.error(`Fichier audio introuvable pour "${song.title}"`);
          } else {
            toast.error(`Erreur: ${error.message}`);
          }
        } else {
          toast.error("Erreur inconnue lors de la lecture");
        }
        
        setCurrentSong(null);
        localStorage.removeItem('currentSong');
        setIsPlaying(false);
        setIsChangingSong(false);
      }
    } else if (audioRef.current) {
      // Reprendre la lecture existante
      console.log("▶️ Reprise de la lecture existante");
      try {
        audioRef.current.volume = volume / 100;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("✅ Reprise réussie");
            setIsPlaying(true);
          }).catch(error => {
            console.error("❌ Erreur reprise:", error);
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error("💥 Erreur reprise audio:", error);
        setIsPlaying(false);
      }
    }
  }, [audioRef, currentSong, isChangingSong, preloadNextTracks, setCurrentSong, setIsChangingSong, setIsPlaying, setNextSongPreloaded, volume]);

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
      console.log("Current song stopped immediately");
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
        console.error("Error refreshing current song data:", error);
        return;
      }
      
      if (data) {
        // Update the current song with the fresh data
        const updatedSong: Song = {
          ...currentSong,
          title: data.title || currentSong.title,
          artist: data.artist || currentSong.artist,
          imageUrl: data.image_url || currentSong.imageUrl,
          genre: data.genre || currentSong.genre,
        };
        
        setCurrentSong(updatedSong);
        localStorage.setItem('currentSong', JSON.stringify(updatedSong));
        
        // Update media session metadata
        if ('mediaSession' in navigator) {
          updateMediaSessionMetadata(updatedSong);
        }
        
        console.log("Current song metadata refreshed:", updatedSong.title);
      }
    } catch (error) {
      console.error("Error in refreshCurrentSong:", error);
    }
  }, [currentSong, setCurrentSong]);

  // Function to directly access the audio element
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
