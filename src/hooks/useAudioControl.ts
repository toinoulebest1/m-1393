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
      console.log("Changement de chanson déjà en cours, ignorer l'appel");
      return;
    }
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      setIsChangingSong(true);
      
      console.log("=== TENTATIVE DE LECTURE ===");
      console.log("Chanson demandée:", song.title, "par", song.artist);
      console.log("ID de la chanson:", song.id);
      console.log("Chemin du fichier:", song.url);
      console.log("=============================");
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      if ('mediaSession' in navigator) {
        updateMediaSessionMetadata(song);
      }

      try {
        console.log("=== RÉCUPÉRATION DU FICHIER AUDIO ===");
        console.log("Appel de getAudioFile avec le chemin:", song.url);
        
        const audioUrl = await getAudioFile(song.url);
        if (!audioUrl) {
          console.error("=== ERREUR: Aucune URL audio retournée ===");
          throw new Error('Fichier audio non trouvé');
        }

        console.log("=== URL AUDIO RÉCUPÉRÉE ===");
        console.log("URL générée:", audioUrl);
        console.log("Type d'URL:", audioUrl.startsWith('http') ? 'HTTP' : audioUrl.startsWith('blob:') ? 'Blob' : 'Autre');
        console.log("============================");

        // Configure CORS for audio elements
        audioRef.current.crossOrigin = "anonymous";
        audioRef.current.src = audioUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.preload = "auto";
        audioRef.current.load();
        
        console.log("=== CONFIGURATION AUDIO ELEMENT ===");
        console.log("Audio URL assignée:", audioUrl);
        console.log("CrossOrigin défini:", audioRef.current.crossOrigin);
        console.log("Ready state:", audioRef.current.readyState);
        console.log("===================================");
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
            audioRef.current.volume = volume / 100;
            console.log("=== LECTURE RÉUSSIE ===");
            console.log("Chanson:", song.title);
            console.log("Volume:", audioRef.current.volume);
            console.log("======================");
            
            setTimeout(() => preloadNextTracks(), 1000);
            
            changeTimeoutRef.current = window.setTimeout(() => {
              setIsChangingSong(false);
              changeTimeoutRef.current = null;
            }, 1200);
          }).catch(error => {
            console.error("=== ERREUR DE LECTURE ===");
            console.error("Type d'erreur:", error.name);
            console.error("Message:", error.message);
            console.error("Erreur complète:", error);
            console.error("URL tentée:", audioUrl);
            console.error("========================");
            
            // Handle CORS errors specifically
            if (error.name === 'NotAllowedError' || error.message.includes('CORS')) {
              console.log("=== TENTATIVE SANS CORS ===");
              audioRef.current.crossOrigin = null;
              audioRef.current.load();
              
              audioRef.current.play().then(() => {
                setIsPlaying(true);
                audioRef.current.volume = volume / 100;
                console.log("=== LECTURE SANS CORS RÉUSSIE ===");
                console.log("Chanson:", song.title);
                console.log("================================");
                
                changeTimeoutRef.current = window.setTimeout(() => {
                  setIsChangingSong(false);
                  changeTimeoutRef.current = null;
                }, 1200);
              }).catch(fallbackError => {
                console.error("=== ERREUR LECTURE SANS CORS ===");
                console.error("Erreur fallback:", fallbackError);
                console.error("===============================");
                setIsPlaying(false);
                setIsChangingSong(false);
                toast.error("Impossible de lire ce titre - problème CORS");
              });
            } else {
              setIsPlaying(false);
              setIsChangingSong(false);
              
              // More specific error messages for users
              if (error.name === 'NotSupportedError') {
                toast.error("Format audio non supporté");
              } else if (error.name === 'NetworkError') {
                toast.error("Erreur réseau - fichier inaccessible");
              } else if (error.name === 'AbortError') {
                toast.error("Lecture interrompue");
              } else {
                toast.error(`Impossible de lire ce titre: ${error.message}`);
              }
            }
          });
        }
      } catch (error) {
        console.error("=== ERREUR LORS DE LA RÉCUPÉRATION ===");
        console.error("Erreur:", error);
        console.error("Message:", error instanceof Error ? error.message : 'Erreur inconnue');
        console.error("Chanson:", song.title);
        console.error("Chemin:", song.url);
        console.error("=====================================");
        
        // More specific error handling based on error type
        if (error instanceof Error) {
          if (error.message.includes('non trouvé') || error.message.includes('not found')) {
            toast.error(`Fichier audio introuvable pour "${song.title}"`);
          } else if (error.message.includes('OneDrive') || error.message.includes('Dropbox')) {
            toast.error("Erreur de stockage cloud - contactez l'administrateur");
          } else if (error.message.includes('réseau') || error.message.includes('network')) {
            toast.error("Erreur réseau - vérifiez votre connexion");
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
      try {
        audioRef.current.volume = volume / 100;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch(error => {
            console.error("Error resuming playback:", error);
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error("Error resuming audio:", error);
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
