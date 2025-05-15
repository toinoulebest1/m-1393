
import { useState } from 'react';
import { Song } from '@/types/player';

export const usePlayerState = () => {
  // État du lecteur
  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    const savedSong = localStorage.getItem('currentSong');
    return savedSong ? JSON.parse(savedSong) : null;
  });

  const [savedProgress, setSavedProgress] = useState(() => {
    const saved = localStorage.getItem('audioProgress');
    return saved ? parseFloat(saved) : 0;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(savedProgress);
  const [volume, setVolume] = useState(70);
  const [isChangingSong, setIsChangingSong] = useState(false);
  const [history, setHistory] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1);

  return {
    currentSong,
    setCurrentSong,
    isPlaying,
    setIsPlaying,
    progress,
    setProgress,
    savedProgress,
    setSavedProgress,
    volume,
    setVolume,
    isChangingSong,
    setIsChangingSong,
    history,
    setHistory,
    searchQuery,
    setSearchQuery,
    playbackRate,
    setPlaybackRate
  };
};
