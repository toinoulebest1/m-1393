import { useRef, useState, useEffect, useCallback } from 'react';
import { Song } from '@/types/player';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';
import { toast } from 'sonner';
import { updateMediaSessionMetadata, updatePositionState } from '@/utils/mediaSession';
import { durationToSeconds } from '@/lib/utils';

interface UseAudioControlProps {
  audioRef: React.MutableRefObject<HTMLAudioElement>;
  nextAudioRef: React.MutableRefObject<HTMLAudioElement>;
  currentSong: Song | null;
  setCurrentSong: (song: Song | null) => void;
  isChangingSong: boolean;
  setIsChangingSong: (isChanging: boolean) => void;
  volume: number;
  setIsPlaying: (isPlaying: boolean) => void;
  changeTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setNextSongPreloaded: (preloaded: boolean) => void;
  preloadNextTracks: () => void;
  setDisplayedSong: (song: Song | null) => void;
  apiDurationRef: React.MutableRefObject<number | null>;
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
  apiDurationRef,
}: UseAudioControlProps) => {
  const [playbackRate, setPlaybackRateState] = useState(1);

  const play = useCallback(async (song: Song) => {
    if (isChangingSong) {
      console.log("[useAudioControl.play] Changement de chanson déjà en cours, annulation de la nouvelle requête.");
      return;
    }

    setIsChangingSong(true);
    console.log("[useAudioControl.play] Received request to play song:", song);

    try {
      // Arrêter la chanson actuelle si elle est en cours de lecture
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }

      console.log("[useAudioControl.play] Changing song to:", song.title, "(ID:", song.id, ")");
      setCurrentSong(song);
      setDisplayedSong(song); // Mettre à jour immédiatement la chanson affichée

      // Utiliser UltraFastStreaming pour obtenir l'URL de la chanson
      const { url: audioUrl, duration } = await UltraFastStreaming.getAudioUrlUltraFast(
        song.url,
        song.title,
        song.artist,
        song.id
      );

      if (!audioUrl) {
        throw new Error("Aucune URL audio disponible pour la lecture.");
      }

      audioRef.current.src = audioUrl;
      audioRef.current.load(); // Charger la nouvelle source
      apiDurationRef.current = duration || durationToSeconds(song.duration); // Mettre à jour la durée de l'API

      // Attendre que la nouvelle chanson soit prête à être jouée
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          cleanup();
          resolve();
        };
        const onError = (e: Event) => {
          cleanup();
          console.error("Erreur de chargement audio:", e);
          reject(new Error("Erreur de chargement audio."));
        };
        const cleanup = () => {
          audioRef.current.removeEventListener('canplay', onCanPlay);
          audioRef.current.removeEventListener('error', onError);
        };

        audioRef.current.addEventListener('canplay', onCanPlay, { once: true });
        audioRef.current.addEventListener('error', onError, { once: true });

        // Si déjà prêt, résoudre immédiatement
        if (audioRef.current.readyState >= 3) {
          resolve();
        }
      });

      audioRef.current.volume = volume / 100;
      audioRef.current.playbackRate = playbackRate;

      await audioRef.current.play();
      setIsPlaying(true);
      updateMediaSessionMetadata(song); // Mettre à jour les métadonnées de la session média

      // Précharger la prochaine piste après un court délai
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
      changeTimeoutRef.current = setTimeout(() => {
        preloadNextTracks();
      }, 1000); // Délai d'une seconde avant de précharger la suivante

    } catch (error) {
      console.error("💥 Erreur critique lors de la lecture:", error);
      toast.error("Erreur de lecture", {
        description: (error as Error).message || "Impossible de lire la chanson."
      });
      setIsPlaying(false);
      setCurrentSong(null);
      setDisplayedSong(null);
    } finally {
      setIsChangingSong(false);
    }
  }, [
    audioRef,
    setCurrentSong,
    setIsPlaying,
    volume,
    playbackRate,
    isChangingSong,
    setIsChangingSong,
    changeTimeoutRef,
    preloadNextTracks,
    setDisplayedSong,
    apiDurationRef
  ]);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, [audioRef, setIsPlaying]);

  const updateVolume = useCallback((newVolume: number) => {
    audioRef.current.volume = newVolume / 100;
  }, [audioRef]);

  const updateProgress = useCallback((newProgress: number) => {
    if (audioRef.current && apiDurationRef.current) {
      audioRef.current.currentTime = (newProgress / 100) * apiDurationRef.current;
    }
  }, [audioRef, apiDurationRef]);

  const updatePlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, [audioRef]);

  const stopCurrentSong = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = ''; // Effacer la source pour libérer les ressources
    }
    setIsPlaying(false);
    setCurrentSong(null);
    setDisplayedSong(null);
    setNextSongPreloaded(false);
    apiDurationRef.current = null;
    if (changeTimeoutRef.current) {
      clearTimeout(changeTimeoutRef.current);
    }
  }, [audioRef, setIsPlaying, setCurrentSong, setDisplayedSong, setNextSongPreloaded, changeTimeoutRef, apiDurationRef]);

  const refreshCurrentSong = useCallback(async () => {
    if (currentSong) {
      console.log("[useAudioControl.refreshCurrentSong] Rafraîchissement de la chanson actuelle:", currentSong.title);
      const wasPlaying = !audioRef.current.paused;
      const currentTime = audioRef.current.currentTime;

      await play(currentSong);

      if (audioRef.current && currentTime > 0) {
        audioRef.current.currentTime = currentTime;
      }
      if (!wasPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [currentSong, audioRef, play, setIsPlaying]);

  const getCurrentAudioElement = useCallback(() => audioRef.current, [audioRef]);

  return {
    play,
    pause,
    updateVolume,
    updateProgress,
    updatePlaybackRate,
    stopCurrentSong,
    refreshCurrentSong,
    getCurrentAudioElement,
    playbackRate,
  };
};