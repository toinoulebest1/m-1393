import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getAudioFile } from '@/utils/storage';
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
}

const PlayerContext = createContext<PlayerContextType | null>(null);
const globalAudio = new Audio();

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement>(globalAudio);
  const nextAudioRef = useRef<HTMLAudioElement>(new Audio());
  const [nextSongPreloaded, setNextSongPreloaded] = useState(false);
  const overlapTimeRef = useRef(3);
  const fadingRef = useRef(false);

  const [preferences, setPreferences] = useState({
    crossfadeEnabled: false,
    crossfadeDuration: 3,
  });

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(70);
  const [queue, setQueue] = useState<Song[]>([]);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>(() => {
    const savedStats = localStorage.getItem('favoriteStats');
    return savedStats ? JSON.parse(savedStats) : [];
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [history, setHistory] = useState<Song[]>([]);

  const play = async (song?: Song) => {
    fadingRef.current = false;
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      setCurrentSong(song);
      setNextSongPreloaded(false);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { error: songError } = await supabase
            .from('songs')
            .upsert({
              id: song.id,
              title: song.title,
              artist: song.artist,
              file_path: song.url,
              duration: song.duration,
              image_url: song.imageUrl
            }, {
              onConflict: 'id'
            });

          if (songError) {
            console.error("Erreur lors de l'enregistrement de la chanson:", songError);
          }

          await addToHistory(song);
        }

        const audioUrl = await getAudioFile(song.url);
        if (!audioUrl) {
          throw new Error('Fichier audio non trouvé');
        }

        audioRef.current.volume = 1;
        nextAudioRef.current.volume = 0;
        
        audioRef.current.src = audioUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch(error => {
            console.error("Error starting playback:", error);
            setIsPlaying(false);
          });
        }

        preloadNextSong();
      } catch (error) {
        console.error("Error playing audio:", error);
        setCurrentSong(null);
        setIsPlaying(false);
      }
    } else if (audioRef.current) {
      try {
        audioRef.current.volume = 1;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch(error => {
            console.error("Error resuming playback:", error);
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error("Error resuming audio:", error);
        setIsPlaying(false);
      }
    }
  };

  const preloadNextSong = async () => {
    if (!currentSong || queue.length === 0) return;
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    const nextSong = queue[currentIndex + 1];
    
    if (!nextSong) return;

    try {
      const audioUrl = await getAudioFile(nextSong.url);
      if (!audioUrl) return;

      nextAudioRef.current.src = audioUrl;
      await nextAudioRef.current.load();
      nextAudioRef.current.volume = 0;
      setNextSongPreloaded(true);
    } catch (error) {
      console.error("Erreur lors du préchargement:", error);
    }
  };

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data } = await supabase
          .from('music_preferences')
          .select('crossfade_enabled, crossfade_duration')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (data) {
          setPreferences({
            crossfadeEnabled: data.crossfade_enabled,
            crossfadeDuration: data.crossfade_duration,
          });
          overlapTimeRef.current = data.crossfade_duration;
          console.log('Durée du fondu mise à jour:', data.crossfade_duration);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    };

    loadPreferences();
    
    const preferenceChannel = supabase
      .channel('music_preferences_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'music_preferences'
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.crossfade_duration !== undefined) {
            overlapTimeRef.current = newData.crossfade_duration;
            setPreferences(prev => ({
              ...prev,
              crossfadeDuration: newData.crossfade_duration,
              crossfadeEnabled: newData.crossfade_enabled
            }));
            console.log('Durée du fondu mise à jour (temps réel):', newData.crossfade_duration);
          }
        }
      )
      .subscribe();

    return () => {
      preferenceChannel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;

    const handleTimeUpdate = () => {
      if (!currentSong || !nextSongPreloaded || fadingRef.current) return;

      const timeLeft = audioRef.current.duration - audioRef.current.currentTime;
      
      if (timeLeft <= overlapTimeRef.current && nextAudioRef.current.paused) {
        fadingRef.current = true;

        const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
        const nextSong = queue[currentIndex + 1];
        
        if (nextSong) {
          // Afficher l'alerte de prochaine chanson
          const alertElement = document.getElementById('next-song-alert');
          const titleElement = document.getElementById('next-song-title');
          const artistElement = document.getElementById('next-song-artist');

          if (alertElement && titleElement && artistElement) {
            titleElement.textContent = nextSong.title;
            artistElement.textContent = nextSong.artist;
            alertElement.classList.remove('opacity-0', 'translate-y-2');
            alertElement.classList.add('opacity-100', 'translate-y-0');

            // Cacher l'alerte après 3 secondes
            setTimeout(() => {
              alertElement.classList.add('opacity-0', 'translate-y-2');
              alertElement.classList.remove('opacity-100', 'translate-y-0');
            }, 3000);
          }
        }

        nextAudioRef.current.currentTime = 0;
        const playPromise = nextAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Erreur lors du démarrage du fondu:", error);
            fadingRef.current = false;
          });
        }

        const steps = 100;
        const intervalTime = (overlapTimeRef.current * 1000) / steps;
        const volumeStep = 1 / steps;

        let currentOutVolume = 1;
        let currentInVolume = 0;

        const fadeInterval = setInterval(() => {
          if (currentOutVolume > 0 || currentInVolume < 1) {
            currentOutVolume = Math.max(0, currentOutVolume - volumeStep);
            currentInVolume = Math.min(1, currentInVolume + volumeStep);
            
            if (audioRef.current) audioRef.current.volume = currentOutVolume;
            if (nextAudioRef.current) nextAudioRef.current.volume = currentInVolume;
          } else {
            clearInterval(fadeInterval);
            
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }

            const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
            const nextSong = queue[currentIndex + 1];
            if (nextSong) {
              setCurrentSong(nextSong);
              
              const tempAudio = audioRef.current;
              audioRef.current = nextAudioRef.current;
              nextAudioRef.current = tempAudio;
              
              setProgress(0);
              setNextSongPreloaded(false);
              fadingRef.current = false;
              
              preloadNextSong();
            }
          }
        }, intervalTime);
      }
    };

    const handleEnded = () => {
      if (!fadingRef.current) {
        setProgress(0);
        const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
        const nextSong = queue[currentIndex + 1];
        
        if (nextSong) {
          play(nextSong);
        } else if (repeatMode === 'all') {
          play(queue[0]);
        } else {
          setIsPlaying(false);
        }
      }
    };

    const handleTimeUpdateProgress = () => {
      const percentage = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(percentage);
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('timeupdate', handleTimeUpdateProgress);
    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdateProgress);
        audioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, [currentSong, nextSongPreloaded, queue, play, repeatMode]);

  useEffect(() => {
    if (currentSong) {
      preloadNextSong();
    }
  }, [currentSong]);

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
    fadingRef.current = false;
    nextAudioRef.current.volume = 0;
    audioRef.current.volume = 1;
    
    const next = getNextSong();
    if (next) {
      play(next);
    } else if (repeatMode === 'all') {
      play(queue[0]);
    }
  };

  const previousSong = () => {
    fadingRef.current = false;
    nextAudioRef.current.volume = 0;
    audioRef.current.volume = 1;
    
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      const isFavorite = favorites.some(f => f.id === song.id);
      
      if (isFavorite) {
        const { error } = await supabase
          .from('favorite_stats')
          .delete()
          .eq('song_id', song.id)
          .eq('user_id', session.user.id);

        if (error) {
          console.error("Erreur lors de la suppression du favori:", error);
          return;
        }

        setFavorites(prev => prev.filter(f => f.id !== song.id));
      } else {
        const { data: existingSong, error: songCheckError } = await supabase
          .from('songs')
          .select()
          .eq('id', song.id)
          .single();

        if (!existingSong) {
          const { error: songInsertError } = await supabase
            .from('songs')
            .insert({
              id: song.id,
              title: song.title,
              artist: song.artist,
              file_path: song.url,
              duration: song.duration,
              image_url: song.imageUrl
            });

          if (songInsertError) {
            console.error("Erreur lors de l'ajout de la chanson:", songInsertError);
            return;
          }
        }

        const { error: favoriteError } = await supabase
          .from('favorite_stats')
          .insert({
            song_id: song.id,
            user_id: session.user.id,
            count: 1
          });

        if (favoriteError) {
          console.error("Erreur lors de l'ajout aux favoris:", favoriteError);
          return;
        }

        setFavorites(prev => [...prev, song]);
      }
    } catch (error) {
      console.error("Erreur lors de la gestion des favoris:", error);
    }
  };

  const removeFavorite = async (songId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      const { error } = await supabase
        .from('favorite_stats')
        .delete()
        .eq('song_id', songId)
        .eq('user_id', session.user.id);

      if (error) {
        console.error("Erreur lors de la suppression du favori:", error);
        return;
      }

      setFavorites(prev => prev.filter(s => s.id !== songId));
    } catch (error) {
      console.error("Erreur lors de la suppression du favori:", error);
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

      const { error: songError } = await supabase
        .from('songs')
        .upsert({
          id: song.id,
          title: song.title,
          artist: song.artist,
          duration: song.duration,
          file_path: song.url,
          image_url: song.imageUrl
        });

      if (songError) {
        console.error("Erreur lors de l'insertion de la chanson:", songError);
        return;
      }

      const { error: historyError } = await supabase
        .from('play_history')
        .insert({
          user_id: session.user.id,
          song_id: song.id,
          played_at: new Date().toISOString()
        });

      if (historyError) {
        console.error("Erreur lors de l'ajout à l'historique:", historyError);
        return;
      }

      setHistory(prev => [{
        ...song,
        playedAt: new Date().toISOString()
      }, ...prev.filter(s => s.id !== song.id)]);

    } catch (error) {
      console.error("Erreur lors de l'ajout à l'historique:", error);
    }
  };

  useEffect(() => {
    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      setIsPlaying(false);
    };

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
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
  }, [repeatMode, nextSong]);

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
