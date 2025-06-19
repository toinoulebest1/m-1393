
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
    if (isChangingSong) return;
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      setIsChangingSong(true);
      
      // Configuration ultra-rapide immédiate
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      if ('mediaSession' in navigator) {
        updateMediaSessionMetadata(song);
      }

      try {
        // Pré-configuration audio optimisée
        const audio = audioRef.current;
        audio.crossOrigin = "anonymous";
        audio.preload = "none";
        audio.volume = volume / 100;
        
        // Optimisations streaming agressives
        if ('fastSeek' in audio) {
          (audio as any).fastSeek = true;
        }
        
        const startTime = performance.now();
        
        // Triple stratégie parallèle pour URL ultra-rapide
        const [cachePromise, storagePromise, backupPromise] = [
          // Stratégie 1: Cache instantané (priorité max)
          Promise.race([
            isInCache(song.url).then(async (inCache) => {
              if (inCache) {
                const cached = await getFromCache(song.url);
                if (cached && typeof cached === 'string') {
                  return { url: cached, source: 'cache', priority: 1 };
                }
              }
              throw new Error('No cache');
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Cache timeout')), 15))
          ]).catch(() => null),
          
          // Stratégie 2: Storage direct (priorité haute)
          getAudioFile(song.url).then(url => {
            if (typeof url === 'string') {
              return { url, source: 'storage', priority: 2 };
            }
            throw new Error('Invalid storage URL');
          }).catch(() => null),
          
          // Stratégie 3: Backup rapide (si disponible)
          new Promise(resolve => setTimeout(() => resolve(null), 50))
        ];

        // Prendre la première URL disponible
        const results = await Promise.allSettled([cachePromise, storagePromise, backupPromise]);
        const validResults = results
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => r.status === 'fulfilled' ? r.value : null)
          .filter(Boolean)
          .sort((a, b) => (a?.priority || 10) - (b?.priority || 10));

        if (validResults.length === 0) {
          throw new Error('Aucune URL disponible');
        }

        const audioData = validResults[0];
        const audioUrl = audioData.url;
        const elapsed = performance.now() - startTime;
        
        if (elapsed < 50) {
          console.log(`⚡ Ultra-rapide: ${elapsed.toFixed(0)}ms (${audioData.source})`);
        }

        // Configuration streaming hyper-optimisée
        audio.src = audioUrl;
        
        // Optimisations navigateur
        if (audioUrl.startsWith('http')) {
          audio.preload = "metadata";
          
          // Cache intelligent en arrière-plan (sans attendre)
          if (audioData.source !== 'cache') {
            setTimeout(async () => {
              try {
                const response = await fetch(audioUrl, { 
                  method: 'HEAD',
                  cache: 'force-cache'
                });
                if (response.ok) {
                  // Cache différé pour ne pas ralentir
                  fetch(audioUrl).then(r => r.blob()).then(blob => {
                    addToCache(song.url, blob);
                  });
                }
              } catch (e) { /* Silent fail */ }
            }, 25);
          }
        } else {
          audio.preload = "auto";
        }
        
        // Démarrage immédiat ultra-optimisé
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            const totalTime = performance.now() - startTime;
            if (totalTime < 100) {
              console.log(`🚀 Instantané: ${totalTime.toFixed(0)}ms`);
            }
            
            setIsPlaying(true);
            
            // Pré-chargement intelligent différé
            setTimeout(preloadNextTracks, 150);
            
            // Fin de changement ultra-rapide
            changeTimeoutRef.current = window.setTimeout(() => {
              setIsChangingSong(false);
              changeTimeoutRef.current = null;
            }, 75);
            
          }).catch(error => {
            if (error.name === 'NotAllowedError') {
              toast.error("Cliquez pour activer l'audio");
            } else {
              toast.error("Erreur de lecture");
            }
            setIsPlaying(false);
            setIsChangingSong(false);
          });
        }
      } catch (error) {
        console.error("Erreur lecture:", error);
        toast.error(`Impossible de lire "${song.title}"`);
        setCurrentSong(null);
        localStorage.removeItem('currentSong');
        setIsPlaying(false);
        setIsChangingSong(false);
      }
    } else if (audioRef.current) {
      // Reprise ultra-rapide
      try {
        audioRef.current.volume = volume / 100;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => setIsPlaying(true)).catch(error => {
            if (error.name === 'NotAllowedError') {
              toast.error("Cliquez pour reprendre");
            }
            setIsPlaying(false);
          });
        }
      } catch (error) {
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
    if (audioRef.current && audioRef.current.duration) {
      const time = (newProgress / 100) * audioRef.current.duration;
      if ('fastSeek' in audioRef.current) {
        (audioRef.current as any).fastSeek(time);
      } else {
        audioRef.current.currentTime = time;
      }
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
      }
    } catch (error) {
      console.error("Error in refreshCurrentSong:", error);
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
