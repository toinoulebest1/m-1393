
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getAudioFile, storeAudioFile } from '@/utils/storage';
import { supabase } from '@/integrations/supabase/client';

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
  bitrate?: string;
}

interface FavoriteStat {
  songId: string;
  count: number;
  lastUpdated: number;
  song: Song;
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
}

const PlayerContext = createContext<PlayerContextType | null>(null);
const globalAudio = new Audio();

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(70);
  const [queue, setQueue] = useState<Song[]>([]);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [favorites, setFavorites] = useState<Song[]>(() => {
    const savedFavorites = localStorage.getItem('favorites');
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>(() => {
    const savedStats = localStorage.getItem('favoriteStats');
    return savedStats ? JSON.parse(savedStats) : [];
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(globalAudio);

  useEffect(() => {
    audioRef.current.volume = volume / 100;
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const play = async (song?: Song) => {
    if (song && (!currentSong || song.id !== currentSong.id)) {
      setCurrentSong(song);
      try {
        const audioUrl = await getAudioFile(song.url);
        if (!audioUrl) {
          throw new Error('Fichier audio non trouvé');
        }

        audioRef.current.src = audioUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
            toast.success(`Lecture de ${song.title}`);
          }).catch(error => {
            console.error("Error starting playback:", error);
            toast.error("Erreur lors de la lecture");
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error("Error playing audio:", error);
        toast.error("Impossible de lire ce fichier audio");
        setCurrentSong(null);
        setIsPlaying(false);
      }
    } else if (audioRef.current) {
      try {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch(error => {
            console.error("Error resuming playback:", error);
            toast.error("Erreur lors de la reprise de la lecture");
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error("Error resuming audio:", error);
        toast.error("Erreur lors de la reprise de la lecture");
        setIsPlaying(false);
      }
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  const updateVolume = (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    setVolume(newVolume);
  };

  const updateProgress = (newProgress: number) => {
    if (audioRef.current) {
      const time = (newProgress / 100) * audioRef.current.duration;
      audioRef.current.currentTime = time;
    }
    setProgress(newProgress);
  };

  const getNextSong = () => {
    const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
    if (shuffleMode) {
      const remainingSongs = queue.slice(currentIndex + 1);
      const randomIndex = Math.floor(Math.random() * remainingSongs.length);
      return remainingSongs[randomIndex];
    }
    return currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null;
  };

  const nextSong = () => {
    const next = getNextSong();
    if (next) {
      play(next);
    } else if (repeatMode === 'all') {
      play(queue[0]);
    }
  };

  const previousSong = () => {
    const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
    if (currentIndex > 0) {
      play(queue[currentIndex - 1]);
    }
  };

  const addToQueue = (song: Song) => {
    setQueue(prevQueue => {
      if (prevQueue.length === 0 && !currentSong) {
        play(song);
      }
      return [...prevQueue, song];
    });
  };

  const toggleShuffle = () => {
    setShuffleMode(prev => !prev);
  };

  const toggleRepeat = () => {
    setRepeatMode(current => {
      switch (current) {
        case 'none': return 'one';
        case 'one': return 'all';
        case 'all': return 'none';
      }
    });
  };

  const toggleFavorite = async (song: Song) => {
    try {
      const audioUrl = await getAudioFile(song.url);
      if (!audioUrl) {
        toast.error("Le fichier audio n'est pas disponible");
        return;
      }

      const isFavorite = favorites.some(f => 
        f.title.toLowerCase() === song.title.toLowerCase() && 
        f.artist?.toLowerCase() === song.artist?.toLowerCase()
      );
      
      if (isFavorite) {
        const existingFavorite = favorites.find(f => 
          f.title.toLowerCase() === song.title.toLowerCase() && 
          f.artist?.toLowerCase() === song.artist?.toLowerCase()
        );
        
        if (existingFavorite) {
          await removeFavorite(existingFavorite.id);
          toast.success("Retiré des favoris");
        }
        return;
      }

      const favoriteId = crypto.randomUUID();
      storeAudioFile(favoriteId, audioUrl);
      
      const { error: songError } = await supabase
        .from('songs')
        .upsert({
          id: favoriteId,
          title: song.title,
          artist: song.artist,
          file_path: favoriteId
        })
        .select()
        .single();

      if (songError) {
        console.error("Error creating song entry:", songError);
        toast.error("Erreur lors de la création de l'entrée de la chanson");
        return;
      }

      const { error: statError } = await supabase
        .from('favorite_stats')
        .insert({
          song_id: favoriteId,
          count: 1,
          last_updated: new Date().toISOString()
        });

      if (statError) {
        console.error("Error inserting stats:", statError);
        toast.error("Erreur lors de l'ajout des statistiques");
      }

      const favoriteSong = {
        ...song,
        id: favoriteId,
        url: favoriteId
      };

      setFavorites(prev => {
        const newFavorites = [...prev, favoriteSong];
        localStorage.setItem('favorites', JSON.stringify(newFavorites));
        return newFavorites;
      });
      
      toast.success("Ajouté aux favoris");
    } catch (error) {
      console.error("Erreur lors de la gestion des favoris:", error);
      toast.error("Erreur lors de la gestion des favoris");
    }
  };

  const removeFavorite = async (songId: string) => {
    try {
      setFavorites(prev => {
        const newFavorites = prev.filter(s => s.id !== songId);
        localStorage.setItem('favorites', JSON.stringify(newFavorites));
        return newFavorites;
      });

      const { error } = await supabase
        .from('favorite_stats')
        .delete()
        .eq('song_id', songId);

      if (error) {
        console.error("Error removing favorite stats:", error);
        toast.error("Erreur lors de la suppression des statistiques");
      } else {
        toast.success("Favori supprimé avec succès");
      }
    } catch (error) {
      console.error("Error removing favorite:", error);
      toast.error("Erreur lors de la suppression du favori");
    }
  };

  const updatePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      toast.success(`Vitesse de lecture : ${rate}x`);
    }
  };

  useEffect(() => {
    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      toast.error("Erreur lors de la lecture audio");
      setIsPlaying(false);
    };

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            toast.error("Erreur lors de la reprise de la lecture");
          });
        }
      } else {
        nextSong();
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleTimeUpdate = () => {
      const percentage = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(percentage);
    };

    audioRef.current.addEventListener('error', handleError);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('play', handlePlay);
    audioRef.current.addEventListener('pause', handlePause);
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audioRef.current.removeEventListener('error', handleError);
      audioRef.current.removeEventListener('ended', handleEnded);
      audioRef.current.removeEventListener('play', handlePlay);
      audioRef.current.removeEventListener('pause', handlePause);
      audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [repeatMode]);

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
