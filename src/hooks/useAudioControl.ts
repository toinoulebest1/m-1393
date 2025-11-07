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
            audio.src = ''; 
            reject(new Error(error));
          };

          timer = window.setTimeout(() => onError('Timeout du watchdog'), watchdogTimeout);
          
          audio.addEventListener('canplay', onCanPlay);
          audio.addEventListener('error', onError);
          audio.addEventListener('stalled', onError);
          
          audio.src = url;
          audio.load();
        });
      };

      try {
        const startTime = performance.now();
        let audioUrlResult: { url: string; duration?: number } | null = null;
        let wasFromCache = false;

        // 1. Cache IndexedDB (priorité absolue pour toutes les pistes)
        const cachedDiskUrl = await getFromCache(song.url);
        if (cachedDiskUrl) {
          audioUrlResult = { url: cachedDiskUrl };
          wasFromCache = true;
          console.log("✅⚡ Cache IndexedDB HIT!", (performance.now() - startTime).toFixed(1), "ms");
          // Le watchdog validera même le cache
          await validateUrlWithWatchdog(audioUrlResult.url);
        }

        // 2. Si pas en cache, choisir la bonne stratégie (Réseau Deezer vs Stockage Local)
        if (!audioUrlResult) {
          const providers: { name: string; func: () => Promise<{ url: string; duration?: number; }> }[] = [];
          const deezerId = song.deezer_id || (song.url.startsWith('deezer:') ? song.url.split(':')[1] : null);

          if (deezerId) {
            console.log(`🎵 Piste Deezer détectée (ID: ${deezerId}). Utilisation des proxies audio.`);
            providers.push({ name: 'Deezmate', func: () => audioProxyService.tryDeezmate(deezerId) });
            providers.push({ name: 'Flacdownloader', func: () => audioProxyService.tryFlacdownloader(deezerId) });
          } else {
            console.log(`🗄️ Piste locale détectée. Utilisation du stockage local.`);
            providers.push({ name: 'Stockage Local', func: () => getAudioFileUrl(song.url) });
          }

          // Boucle de fallback sur les fournisseurs définis
          for (const provider of providers) {
            try {
              console.log(`➡️ Tentative avec la source: ${provider.name}`);
              const result = await provider.func();
              await validateUrlWithWatchdog(result.url); // Le watchdog valide la source
              audioUrlResult = result;
              console.log(`✅ Succès avec ${provider.name}`);
              break; // On a trouvé une source valide, on arrête
            } catch (error) {
              console.warn(`⚠️ Échec avec ${provider.name}:`, (error as Error).message);
              // La boucle continue avec le fournisseur suivant
            }
          }
        }

        if (!audioUrlResult?.url) {
          throw new Error("Toutes les sources audio ont échoué. Musique indisponible.");
        }
        
        const success = await AutoplayManager.playAudio(audio);
        
        if (success) {
          setIsPlaying(true);
          console.log("✅ Lecture démarrée avec succès.");
          if (apiDurationRef && audioUrlResult.duration) apiDurationRef.current = audioUrlResult.duration;

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