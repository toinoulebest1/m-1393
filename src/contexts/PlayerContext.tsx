import React, {
  createContext,
  useCallback,
  useState,
  useRef,
  useEffect,
  useMemo,
  ReactNode
} from 'react';
import { Song } from '@/types/player';
import { useAudioControl } from '@/hooks/useAudioControl';
import { usePlayerQueue } from '@/hooks/usePlayerQueue';
import { usePlayerFavorites } from '@/hooks/usePlayerFavorites';
import { usePlayerState } from '@/hooks/usePlayerState';
import { useEqualizer } from '@/hooks/useEqualizer';
import { useInstantPlayer } from '@/hooks/useUltraFastPlayer';
import { UltraFastStreaming } from '@/utils/ultraFastStreaming';

interface PlayerContextProps {
  currentSong: Song | null;
  setCurrentSong: (song: Song | null) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
  progress: number;
  setProgress: (progress: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  playbackRate: number;
  setPlaybackRate: (playbackRate: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  nextSong: () => Promise<void>;
  previousSong: () => Promise<void>;
  addToQueue: (song: Song) => void;
  favorites: Song[];
  setFavorites: (favorites: Song[]) => void;
  toggleFavorite: (song: Song) => Promise<void>;
  removeFavorite: (songId: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (searchQuery: string) => void;
  queue: Song[];
  setQueue: (queue: Song[] | ((prevQueue: Song[]) => Song[])) => void;
  shuffleMode: boolean;
  repeatMode: 'none' | 'one' | 'all';
  isChangingSong: boolean;
  setIsChangingSong: (value: boolean) => void;
  stopCurrentSong: () => void;
  refreshCurrentSong: () => Promise<void>;
  getCurrentAudioElement: () => HTMLAudioElement | null;
  getCacheStats: () => any;
}

const defaultContextValue: PlayerContextProps = {
  currentSong: null,
  setCurrentSong: () => {},
  isPlaying: false,
  setIsPlaying: () => {},
  volume: 0.7,
  setVolume: () => {},
  progress: 0,
  setProgress: () => {},
  duration: 0,
  setDuration: () => {},
  playbackRate: 1,
  setPlaybackRate: () => {},
  toggleShuffle: () => {},
  toggleRepeat: () => {},
  nextSong: async () => {},
  previousSong: async () => {},
  addToQueue: () => {},
  favorites: [],
  setFavorites: () => {},
  toggleFavorite: async () => {},
  removeFavorite: async () => {},
  searchQuery: '',
  setSearchQuery: () => {},
  queue: [],
  setQueue: () => {},
  shuffleMode: false,
  repeatMode: 'none',
  isChangingSong: false,
  setIsChangingSong: () => {},
  stopCurrentSong: () => {},
  refreshCurrentSong: async () => {},
  getCurrentAudioElement: () => null,
  getCacheStats: () => {}
};

export const PlayerContext = createContext(defaultContextValue);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  // Refs pour les éléments audio
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const nextAudioRef = useRef<HTMLAudioElement>(new Audio());
  const changeTimeoutRef = useRef<number | null>(null);

  // États pour la chanson actuelle et la lecture
  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    const storedSong = localStorage.getItem('currentSong');
    return storedSong ? JSON.parse(storedSong) : null;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isChangingSong, setIsChangingSong] = useState(false);
  const [nextSongPreloaded, setNextSongPreloaded] = useState(false);

  // États pour le volume, la progression et la vitesse de lecture
  const [volume, setVolume] = useState(0.7);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // États pour l'interface utilisateur et les préférences
  const [searchQuery, setSearchQuery] = useState('');

  // Hooks pour la gestion du lecteur
  const queueHook = usePlayerQueue({
    currentSong,
    isChangingSong,
    setIsChangingSong,
    play: audioControlHook.play
  });

  const favoritesHook = usePlayerFavorites();

  const stateHook = usePlayerState({
    audioRef,
    currentSong,
    setCurrentSong,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    progress,
    setProgress,
    duration,
    setDuration,
    playbackRate,
    setPlaybackRate
  });

  const equalizerHook = useEqualizer({
    audioElement: audioRef.current
  });

  // Hook pour préchargement intelligent (moins agressif)
  const { getCacheStats } = useInstantPlayer({
    currentSong,
    queue: queueHook.queue,
    isPlaying
  });

  // Hook pour le contrôle audio avec préchargement optimisé
  const audioControlHook = useAudioControl({
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
    preloadNextTracks: async () => {
      // Préchargement beaucoup moins agressif
      const currentIndex = queueHook.queue.findIndex(s => s.id === currentSong?.id);
      if (currentIndex !== -1 && currentIndex + 1 < queueHook.queue.length) {
        const nextSong = queueHook.queue[currentIndex + 1];
        if (nextSong) {
          console.log("🎵 Préchargement chanson suivante:", nextSong.title);
          try {
            await UltraFastStreaming.preloadBatch([nextSong.url]);
          } catch (error) {
            console.warn("⚠️ Préchargement suivante échoué (silencieux)");
          }
        }
      }
    }
  });

  // Effet pour mettre à jour le volume de l'élément audio
  useEffect(() => {
    audioControlHook.updateVolume(volume);
  }, [volume, audioControlHook.updateVolume]);

  // Effet pour gérer la fin de la chanson actuelle
  useEffect(() => {
    const handleSongEnded = async () => {
      console.log("Chanson terminée, passage à la suivante...");
      await queueHook.nextSong();
    };

    const audioElement = audioControlHook.getCurrentAudioElement();
    if (audioElement) {
      audioElement.addEventListener('ended', handleSongEnded);
    }

    return () => {
      if (audioElement) {
        audioElement.removeEventListener('ended', handleSongEnded);
      }
    };
  }, [queueHook, audioControlHook]);

  const contextValue = useMemo(() => ({
    currentSong,
    setCurrentSong,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    progress,
    setProgress,
    duration,
    setDuration,
    playbackRate,
    setPlaybackRate,
    toggleShuffle: queueHook.toggleShuffle,
    toggleRepeat: queueHook.toggleRepeat,
    nextSong: queueHook.nextSong,
    previousSong: queueHook.previousSong,
    addToQueue: queueHook.addToQueue,
    favorites: favoritesHook.favorites,
    setFavorites: favoritesHook.setFavorites,
    toggleFavorite: favoritesHook.toggleFavorite,
    removeFavorite: favoritesHook.removeFavorite,
    searchQuery,
    setSearchQuery,
    queue: queueHook.queue,
    setQueue: queueHook.setQueue,
    shuffleMode: queueHook.shuffleMode,
    repeatMode: queueHook.repeatMode,
    isChangingSong,
    setIsChangingSong,
    stopCurrentSong: audioControlHook.stopCurrentSong,
    refreshCurrentSong: audioControlHook.refreshCurrentSong,
    getCurrentAudioElement: audioControlHook.getCurrentAudioElement,
    getCacheStats
  }), [
    currentSong,
    setCurrentSong,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    progress,
    setProgress,
    duration,
    setDuration,
    playbackRate,
    setPlaybackRate,
    queueHook.toggleShuffle,
    queueHook.toggleRepeat,
    queueHook.nextSong,
    queueHook.previousSong,
    queueHook.addToQueue,
    favoritesHook.favorites,
    favoritesHook.setFavorites,
    favoritesHook.toggleFavorite,
    favoritesHook.removeFavorite,
    searchQuery,
    setSearchQuery,
    queueHook.queue,
    queueHook.setQueue,
    queueHook.shuffleMode,
    queueHook.repeatMode,
    isChangingSong,
    setIsChangingSong,
    audioControlHook.stopCurrentSong,
    audioControlHook.refreshCurrentSong,
    audioControlHook.getCurrentAudioElement,
    getCacheStats
  ]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayerContext = () => React.useContext(PlayerContext);
