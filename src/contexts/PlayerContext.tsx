import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAudioFile } from '@/utils/storage';

export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  imageUrl?: string;
  duration?: string;
  bitrate?: string;
}

export interface FavoriteStat {
  songId: string;
  count: number;
  lastUpdated: string;
  song: {
    id: string;
    title: string;
    artist: string;
    url: string;
    duration: string;
  };
}

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  queue: Song[];
  shuffleMode: boolean;
  repeatMode: 'none' | 'one' | 'all';
  favorites: Song[];
  searchQuery: string;
  favoriteStats: FavoriteStat[];
  playbackRate: number;
  history: Song[];
  setHistory: (history: Song[]) => void;
  play: (song?: Song) => void;
  pause: () => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  nextSong: () => void;
  previousSong: () => void;
  addToQueue: (song: Song) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleFavorite: (song: Song) => void;
  removeFavorite: (songId: string) => void;
  setSearchQuery: (query: string) => void;
  setPlaybackRate: (rate: number) => void;
  setQueue: (songs: Song[]) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);
const globalAudio = new Audio();

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(50);
  const [queue, setQueue] = useState<Song[]>([]);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [history, setHistory] = useState<Song[]>([]);
  const [nextSongPreloaded, setNextSongPreloaded] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(globalAudio);
  const nextAudioRef = useRef<HTMLAudioElement>(new Audio());
  const fadingRef = useRef(false);

  const play = (song?: Song) => {
    if (song) {
      setCurrentSong(song);
      setIsPlaying(true);
      audioRef.current.src = song.url;
      audioRef.current.play();
    } else {
      setIsPlaying(true);
      audioRef.current.play();
    }
  };

  const pause = () => {
    setIsPlaying(false);
    audioRef.current.pause();
  };

  const nextSong = () => {
    if (queue.length > 0) {
      setCurrentSong(queue[0]);
      setIsPlaying(true);
      audioRef.current.src = queue[0].url;
      audioRef.current.play();
      setQueue(queue.slice(1));
    }
  };

  const previousSong = () => {
    if (queue.length > 0) {
      setCurrentSong(queue[queue.length - 1]);
      setIsPlaying(true);
      audioRef.current.src = queue[queue.length - 1].url;
      audioRef.current.play();
      setQueue(queue.slice(0, -1));
    }
  };

  const addToQueue = (song: Song) => {
    setQueue(prev => [...prev, song]);
  };

  const toggleShuffle = () => {
    setShuffleMode(!shuffleMode);
  };

  const toggleRepeat = () => {
    if (repeatMode === 'none') {
      setRepeatMode('one');
    } else if (repeatMode === 'one') {
      setRepeatMode('all');
    } else {
      setRepeatMode('none');
    }
  };

  const toggleFavorite = (song: Song) => {
    setFavorites(prev => {
      if (prev.some(f => f.id === song.id)) {
        return prev.filter(f => f.id !== song.id);
      } else {
        return [...prev, song];
      }
    });
  };

  const removeFavorite = (songId: string) => {
    setFavorites(prev => prev.filter(f => f.id !== songId));
  };

  const setSearchQuery = (query: string) => {
    setSearchQuery(query);
  };

  const updateVolume = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };

  const updateProgress = (newProgress: number) => {
    setProgress(newProgress);
    if (audioRef.current) {
      const duration = audioRef.current.duration;
      audioRef.current.currentTime = (newProgress / 100) * duration;
    }
  };

  const updatePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const addToHistory = async (song: Song) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('play_history')
        .insert({
          user_id: session.user.id,
          song_id: song.id,
          played_at: new Date().toISOString()
        });

      if (error) {
        console.error("Error adding to history:", error);
        return;
      }

      setHistory(prev => [song, ...prev]);
    } catch (error) {
      console.error("Error adding to history:", error);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        isPlaying,
        progress,
        volume,
        queue,
        shuffleMode,
        repeatMode,
        favorites,
        searchQuery,
        favoriteStats,
        playbackRate,
        history,
        setHistory,
        play,
        pause,
        setVolume: updateVolume,
        setProgress: updateProgress,
        nextSong,
        previousSong,
        addToQueue,
        toggleShuffle,
        toggleRepeat,
        toggleFavorite,
        removeFavorite,
        setSearchQuery,
        setPlaybackRate: updatePlaybackRate,
        setQueue,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export default PlayerProvider;
