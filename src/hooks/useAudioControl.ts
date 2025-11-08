import { useCallback } from 'react';
import { Song } from '@/types/player';
import { getAudioFileUrl } from '@/utils/storage';
import { updateMediaSessionMetadata, durationToSeconds } from '@/utils/mediaSession';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';

interface UseAudioControlProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  nextAudioRef: React.RefObject<HTMLAudioElement>;
  currentSong: Song | null;
  setCurrentSong: (song: Song | null) => void;
  isChangingSong: boolean;
  setIsChangingSong: (isChanging: boolean) => void;
  volume: number;
  setIsPlaying: (isPlaying: boolean) => void;
  changeTimeoutRef: React.MutableRefObject<number | null>;
  setNextSongPreloaded: (isPreloaded: boolean) => void;
  preloadNextTracks: () => Promise<void>;
  setDisplayedSong: (song: Song | null) => void;
  apiDurationRef: React.MutableRefObject<number | undefined>;
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

  const play = useCallback(async (song: Song) => {
    console.log(`[useAudioControl.play] Received request to play song: ${song?.title}`);
    if (!song) {
      console.error("💥 Erreur critique lors de la lecture: la chanson est indéfinie");
      return;
    }
    if (isChangingSong) {
      console.warn("⚠️ Tentative de lecture pendant un changement de chanson, ignorée.");
      return;
    }

    setIsChangingSong(true);
    setDisplayedSong(song);

    if (changeTimeoutRef.current) {
      clearTimeout(changeTimeoutRef.current);
    }

    try {
      const result = await UltraFastStreaming.getAudioUrlUltraFast(
        song.url,
        song.title,
        song.artist,
        song.id
      );
      if (!result || !result.url) throw new Error("URL audio non trouvée");

      audioRef.current!.src = result.url;
      audioRef.current!.volume = volume / 100;
      
      // Mettre à jour la durée de l'API
      apiDurationRef.current = durationToSeconds(song.duration);

      await audioRef.current!.play();
      
      setIsPlaying(true);
      setCurrentSong(song);
      updateMediaSessionMetadata(song);

      // Précharger la piste suivante
      preloadNextTracks();

    } catch (error) {
      console.error("💥 Erreur lors de la lecture:", error);
      setIsPlaying(false);
    } finally {
      changeTimeoutRef.current = window.setTimeout(() => {
        setIsChangingSong(false);
        setNextSongPreloaded(false);
      }, 500);
    }
  }, [
    isChangingSong,
    volume,
    audioRef,
    nextAudioRef,
    setIsChangingSong,
    setIsPlaying,
    setCurrentSong,
    changeTimeoutRef,
    setNextSongPreloaded,
    preloadNextTracks,
    setDisplayedSong,
    apiDurationRef
  ]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      console.log("Audio paused");
    }
  }, [setIsPlaying, audioRef]);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          console.log("Audio resumed");
        }).catch(error => {
          console.error("Audio resume failed:", error);
          setIsPlaying(false);
        });
      }
    }
  }, [setIsPlaying, audioRef]);

  const updateVolume = useCallback((newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    if (nextAudioRef.current) {
      nextAudioRef.current.volume = newVolume / 100;
    }
  }, [audioRef, nextAudioRef]);

  const updateProgress = useCallback((newProgress: number) => {
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (newProgress / 100) * audioRef.current.duration;
    }
  }, [audioRef]);

  const updatePlaybackRate = useCallback((rate: number, setPlaybackRate: (rate: number) => void) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, [audioRef]);

  const stopCurrentSong = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.src = '';
    }
    setIsPlaying(false);
    setCurrentSong(null);
    setDisplayedSong(null);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }, [audioRef, nextAudioRef, setIsPlaying, setCurrentSong, setDisplayedSong]);

  const refreshCurrentSong = useCallback(async () => {
    if (currentSong) {
      await play(currentSong);
    }
  }, [currentSong, play]);

  const getCurrentAudioElement = useCallback(() => {
    if (audioRef.current && audioRef.current.src) {
      return audioRef.current;
    }
    if (nextAudioRef.current && nextAudioRef.current.src) {
      return nextAudioRef.current;
    }
    return null;
  }, [audioRef, nextAudioRef]);

  return { play, pause, resume, updateVolume, updateProgress, updatePlaybackRate, stopCurrentSong, refreshCurrentSong, getCurrentAudioElement };
};