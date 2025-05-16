
import { useCallback } from 'react';
import { getAudioFile } from '@/utils/storage';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';
import { Song } from '@/types/player';
import { isInCache, getFromCache, addToCache } from '@/utils/audioCache';
import { supabase } from '@/integrations/supabase/client';

interface UseAudioControlProps {
  audioRef: React.MutableRefObject<HTMLAudioElement>;
  nextAudioRef: React.MutableRefObject<HTMLAudioElement>;
  currentSong: Song | null;
  setCurrentSong: (song: Song | null) => void;
  isChangingSong: boolean;
  setIsChangingSong: (value: boolean) => void;
  volume: number;
  setIsPlaying: (value: boolean) => void;
  queue: Song[];
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
  queue,
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
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      if ('mediaSession' in navigator) {
        updateMediaSessionMetadata(song);
      }

      try {
        console.log(`Chargement du titre: ${song.title} (ID: ${song.id})`);
        let audioUrl;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!audioUrl && attempts < maxAttempts) {
          attempts++;
          try {
            console.log(`Tentative ${attempts}/${maxAttempts} pour récupérer l'audio`);
            audioUrl = await getAudioFile(song.url);
          } catch (attemptError) {
            console.warn(`Tentative ${attempts} échouée:`, attemptError);
            
            if (attempts === maxAttempts) {
              throw attemptError;
            }
            
            // Small delay before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (!audioUrl) {
          throw new Error('URL audio non disponible après plusieurs tentatives');
        }

        console.log(`URL audio récupérée: ${audioUrl.substring(0, 50)}...`);
        
        // Set audio attributes and prepare for playback
        audioRef.current.src = audioUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.preload = "auto";
        audioRef.current.crossOrigin = "anonymous"; // Important for CORS
        audioRef.current.load();
        
        // Add event listeners to help debug playback issues
        const onCanPlay = () => {
          console.log("Audio prêt à être joué (événement canplay)");
        };
        
        const onError = (e) => {
          console.error("Erreur de l'élément audio:", e);
          console.error("Code d'erreur:", audioRef.current.error ? audioRef.current.error.code : "inconnu");
          console.error("Message d'erreur:", audioRef.current.error ? audioRef.current.error.message : "inconnu");
        };
        
        audioRef.current.addEventListener('canplay', onCanPlay);
        audioRef.current.addEventListener('error', onError);
        
        // Attempt to play with proper error handling
        try {
          console.log("Tentative de lecture...");
          const playPromise = audioRef.current.play();
          
          if (playPromise !== undefined) {
            playPromise.then(() => {
              console.log("Lecture démarrée avec succès!");
              setIsPlaying(true);
              audioRef.current.volume = volume / 100;
              
              // Clean up event listeners
              audioRef.current.removeEventListener('canplay', onCanPlay);
              audioRef.current.removeEventListener('error', onError);
              
              // Preload next track for smooth transition
              setTimeout(() => preloadNextTracks(), 1000);
              
              changeTimeoutRef.current = window.setTimeout(() => {
                setIsChangingSong(false);
                changeTimeoutRef.current = null;
              }, 1200);
            }).catch(error => {
              console.error("Erreur lors du démarrage de la lecture:", error);
              
              // If autoplay is prevented, show a gentle message
              if (error.name === 'NotAllowedError') {
                toast.error("Lecture automatique bloquée par le navigateur. Cliquez pour lire.");
                setIsPlaying(false);
              } else {
                toast.error(`Impossible de lire le titre: ${error.message || "Erreur inconnue"}`);
              }
              
              // Clean up
              audioRef.current.removeEventListener('canplay', onCanPlay);
              audioRef.current.removeEventListener('error', onError);
              setIsChangingSong(false);
            });
          }
        } catch (playError) {
          console.error("Exception lors de la tentative de lecture:", playError);
          audioRef.current.removeEventListener('canplay', onCanPlay);
          audioRef.current.removeEventListener('error', onError);
          setIsPlaying(false);
          setIsChangingSong(false);
          toast.error("Erreur lors de la lecture audio");
        }
      } catch (error) {
        console.error("Erreur lors du chargement audio:", error);
        toast.error(`Impossible de charger ce titre: ${error.message || "Erreur inconnue"}`);
        setCurrentSong(null);
        localStorage.removeItem('currentSong');
        setIsPlaying(false);
        setIsChangingSong(false);
      }
    } else if (audioRef.current) {
      // Resume playback of current track
      try {
        audioRef.current.volume = volume / 100;
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("Reprise de la lecture avec succès");
            setIsPlaying(true);
          }).catch(error => {
            console.error("Erreur lors de la reprise de la lecture:", error);
            if (error.name === 'NotAllowedError') {
              toast.error("Lecture automatique bloquée par le navigateur. Cliquez pour lire.");
            }
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error("Exception lors de la reprise de la lecture:", error);
        setIsPlaying(false);
        toast.error("Impossible de reprendre la lecture");
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

  // Nouvelle fonction pour accéder directement à l'élément audio
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
