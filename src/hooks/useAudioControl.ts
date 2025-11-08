import { useCallback, useRef } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { getAudioFileUrl } from '@/utils/storage';
import { toast } from 'sonner';
import { updateMediaSessionMetadata, updatePositionState, durationToSeconds } from '@/utils/mediaSession';
import { Song } from '@/types/player';
import { fetchLyricsInBackground } from '@/utils/lyricsManager';
import { AutoplayManager } from '@/utils/autoplayManager';
import { cacheCurrentSong, getFromCache } from '@/utils/audioCache';
import { memoryCache } from '@/utils/memoryCache';

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
  setDisplayedSong: (song: Song | null) => void;
  apiDurationRef?: React.MutableRefObject<number | undefined>;
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
  preloadNextTracks,
  setDisplayedSong,
  apiDurationRef
}: UseAudioControlProps) => {

  const cachingTimeoutRef = useRef<number | null>(null);

  const play = useCallback(async (song?: Song) => {
    if (song && (!currentSong || song.id !== currentSong.id)) {
      console.log(`Changement de chanson vers: ${song.title}`);
      
      if (cachingTimeoutRef.current) {
        clearTimeout(cachingTimeoutRef.current);
      }
      
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsChangingSong(true);
      
      setCurrentSong(song);
      setDisplayedSong(song);
      setNextSongPreloaded(false);
      
      AutoplayManager.registerUserInteraction();

      try {
        const audio = audioRef.current;
        audio.volume = volume / 100;
        
        const startTime = performance.now();
        let audioUrl: string;
        let apiDuration: number | undefined;
        let wasFromCache = false;

        // 1. Cache mémoire (ultra-rapide)
        const cachedMemoryUrl = memoryCache.get(song.url);
        if (cachedMemoryUrl) {
          audioUrl = cachedMemoryUrl;
          console.log("✅⚡ Cache mémoire HIT!", (performance.now() - startTime).toFixed(1), "ms");
        } else {
          // 2. Cache IndexedDB (rapide)
          const cachedDiskUrl = await getFromCache(song.url);
          if (cachedDiskUrl) {
            audioUrl = cachedDiskUrl;
            wasFromCache = true;
            console.log("✅⚡ Cache IndexedDB HIT!", (performance.now() - startTime).toFixed(1), "ms");
          } else {
            // 3. Réseau (le plus lent)
            const result = await getAudioFileUrl(song.url, song.deezer_id, song.title, song.artist, song.id);
            if (!result?.url) throw new Error("URL audio non disponible depuis le réseau");
            audioUrl = result.url;
            apiDuration = result.duration;
            console.log("✅⚡ Réseau OK!", (performance.now() - startTime).toFixed(1), "ms");
          }
          // Mettre en cache mémoire pour les relectures rapides
          memoryCache.set(song.url, audioUrl);
        }

        if (apiDuration && apiDurationRef) {
          apiDurationRef.current = apiDuration;
        }

        audio.src = audioUrl;
        const success = await AutoplayManager.playAudio(audio);
        
        if (success) {
          setIsPlaying(true);
          console.log("✅ Lecture démarrée avec succès.");

          // --- Tâches non critiques, différées ---
          setTimeout(() => {
            console.log("🚀 Lancement des tâches post-lecture...");
            updateMediaSessionMetadata(song);
            
            // Mise en cache en arrière-plan si nécessaire
            if (!wasFromCache) {
              cachingTimeoutRef.current = window.setTimeout(() => {
                (async () => {
                  try {
                    const response = await fetch(audioUrl);
                    if (response.ok) {
                      const blob = await response.blob();
                      await cacheCurrentSong(song.url, blob, song.id, song.title);
                      console.log("✅ Chanson mise en cache en arrière-plan:", song.title);
                    }
                  } catch (e) {
                    console.warn('⚠️ Échec de la mise en cache en arrière-plan:', e);
                  }
                })();
              }, 3000);
            }
            
            // Autres tâches
            fetchLyricsInBackground(song.id, song.title, song.artist, song.duration, song.album_name, song.isDeezer);
            preloadNextTracks();
          }, 100); // Différer de 100ms

        } else {
          console.log("⚠️ Lecture en attente d'activation utilisateur");
        }
        
        setIsChangingSong(false);

      } catch (error) {
        console.error("💥 Erreur critique lors de la lecture:", error);
        toast.error("Musique indisponible", { description: (error as Error).message });
        setIsChangingSong(false);
        setIsPlaying(false);
      }
    } else if (audioRef.current) {
      // Reprise de la lecture
      const success = await AutoplayManager.playAudio(audioRef.current);
      if (success) setIsPlaying(true);
    }
  }, [currentSong, isChangingSong, volume, audioRef, nextAudioRef, setCurrentSong, setDisplayedSong, setIsChangingSong, setIsPlaying, setNextSongPreloaded, preloadNextTracks, apiDurationRef]);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, [audioRef, setIsPlaying]);

  const updateVolume = useCallback((newVolume: number) => {
    if (audioRef.current) audioRef.current.volume = newVolume / 100;
    return newVolume;
  }, [audioRef]);

  const updateProgress = useCallback((newProgress: number) => {
    if (audioRef.current?.duration) {
      audioRef.current.currentTime = (newProgress / 100) * audioRef.current.duration;
    }
    return newProgress;
  }, [audioRef]);

  const updatePlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
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
    // Logique de rafraîchissement...
  }, [currentSong, setCurrentSong]);

  const getCurrentAudioElement = useCallback(() => {
    return audioRef.current;
  }, [audioRef]);

  return { play, pause, updateVolume, updateProgress, updatePlaybackRate, stopCurrentSong, refreshCurrentSong, getCurrentAudioElement };
};