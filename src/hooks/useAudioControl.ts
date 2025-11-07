import { useCallback, useRef } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { getAudioFileUrl } from '@/utils/storage';
import { toast } from 'sonner';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';
import { Song } from '@/types/player';
import { fetchLyricsInBackground } from '@/utils/lyricsManager';
import { AutoplayManager } from '@/utils/autoplayManager';
import { cacheCurrentSong, getFromCache } from '@/utils/audioCache';
import { memoryCache } from '@/utils/memoryCache';
import { audioProxyService } from '@/services/audioProxyService';

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
      
      if (cachingTimeoutRef.current) clearTimeout(cachingTimeoutRef.current);
      
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsChangingSong(true);
      
      setCurrentSong(song);
      setDisplayedSong(song);
      setNextSongPreloaded(false);
      
      AutoplayManager.registerUserInteraction();

      const audio = audioRef.current;
      audio.volume = volume / 100;

      // --- Watchdog pour valider une URL ---
      const validateUrlWithWatchdog = (url: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          const watchdogTimeout = 3000; // 3 secondes pour considérer la source KO
          let timer: number;

          const cleanup = () => {
            clearTimeout(timer);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('stalled', onError);
          };

          const onCanPlay = () => {
            console.log("✅ Watchdog: 'canplay' reçu. Source valide.");
            cleanup();
            resolve();
          };

          const onError = (e: Event | string) => {
            const error = e instanceof Event ? (audio.error?.message || 'Erreur média inconnue') : e;
            console.error("❌ Watchdog: Erreur média. Source invalide.", error);
            cleanup();
            // Vider la source pour éviter que le player reste en état d'erreur
            audio.src = ''; 
            reject(new Error(error));
          };

          timer = window.setTimeout(() => onError('Timeout du watchdog'), watchdogTimeout);
          
          audio.addEventListener('canplay', onCanPlay);
          audio.addEventListener('error', onError);
          audio.addEventListener('stalled', onError); // Gère les cas de blocage réseau
          
          audio.src = url;
          audio.load(); // Important pour déclencher les événements
        });
      };

      try {
        const startTime = performance.now();
        let audioUrlResult: { url: string; duration?: number } | null = null;
        let wasFromCache = false;

        // 1. Cache IndexedDB (priorité absolue)
        const cachedDiskUrl = await getFromCache(song.url);
        if (cachedDiskUrl) {
          audioUrlResult = { url: cachedDiskUrl };
          wasFromCache = true;
          console.log("✅⚡ Cache IndexedDB HIT!", (performance.now() - startTime).toFixed(1), "ms");
        }

        // 2. Si pas en cache, construire la chaîne de fallback
        if (!audioUrlResult) {
          const providers = [];
          if (song.deezer_id) {
            providers.push({ name: 'Deezmate', func: () => audioProxyService.tryDeezmate(song.deezer_id!) });
            providers.push({ name: 'Flacdownloader', func: () => audioProxyService.tryFlacdownloader(song.deezer_id!) });
          }
          providers.push({ name: 'Stockage Local', func: () => getAudioFileUrl(song.url) });

          for (const provider of providers) {
            try {
              console.log(`➡️ Tentative avec la source: ${provider.name}`);
              const result = await provider.func();
              await validateUrlWithWatchdog(result.url);
              audioUrlResult = result;
              console.log(`✅ Succès avec ${provider.name}`);
              break; // Sortir de la boucle si une source est valide
            } catch (error) {
              console.warn(`⚠️ Échec avec ${provider.name}:`, (error as Error).message);
              // Continuer vers le provider suivant
            }
          }
        }

        if (!audioUrlResult?.url) {
          throw new Error("Toutes les sources audio ont échoué. Musique indisponible.");
        }
        
        // La lecture a déjà été initiée par le watchdog, il suffit de confirmer l'état
        const success = await AutoplayManager.playAudio(audio);
        
        if (success) {
          setIsPlaying(true);
          console.log("✅ Lecture démarrée avec succès.");
          if (apiDurationRef && audioUrlResult.duration) apiDurationRef.current = audioUrlResult.duration;

          // --- Tâches non critiques, différées ---
          setTimeout(() => {
            console.log("🚀 Lancement des tâches post-lecture...");
            updateMediaSessionMetadata(song);
            
            if (!wasFromCache) {
              cachingTimeoutRef.current = window.setTimeout(() => {
                (async () => {
                  try {
                    const response = await fetch(audioUrlResult!.url);
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
            
            fetchLyricsInBackground(song.id, song.title, song.artist, song.duration, song.album_name, song.isDeezer);
            preloadNextTracks();
          }, 100);

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
      const success = await AutoplayManager.playAudio(audioRef.current);
      if (success) setIsPlaying(true);
    }
  }, [currentSong, isChangingSong, volume, audioRef, setCurrentSong, setDisplayedSong, setIsChangingSong, setIsPlaying, setNextSongPreloaded, preloadNextTracks, apiDurationRef]);

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