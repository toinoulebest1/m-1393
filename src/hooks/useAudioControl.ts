
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
        let audioUrl;
        try {
          audioUrl = await getAudioFile(song.url);
        } catch (firstError) {
          console.warn("Première tentative échouée, nouvel essai avec le stockage direct:", firstError);
          const { data } = supabase.storage.from('audio').getPublicUrl(song.url);
          audioUrl = data.publicUrl;
        }
        
        if (!audioUrl) {
          throw new Error('Fichier audio non trouvé');
        }

        audioRef.current.src = audioUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.preload = "auto";
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
            audioRef.current.volume = volume / 100;
            console.log("Lecture démarrée avec succès:", song.title);
            
            setTimeout(() => preloadNextTracks(), 1000);
            
            changeTimeoutRef.current = window.setTimeout(() => {
              setIsChangingSong(false);
              changeTimeoutRef.current = null;
            }, 1200);
          }).catch(error => {
            console.error("Error starting playback:", error);
            setIsPlaying(false);
            setIsChangingSong(false);
          });
        }
      } catch (error) {
        console.error("Error playing audio:", error);
        toast.error("Impossible de lire ce titre");
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
