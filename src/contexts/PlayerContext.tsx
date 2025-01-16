import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getAudioFile, storeAudioFile } from '@/utils/storage';
import { supabase } from '@/integrations/supabase/client';
import { downloadAndStoreAudio, getOfflineAudio } from '@/utils/offlineStorage';

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
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
  const audioRef = useRef<HTMLAudioElement>(globalAudio);

  useEffect(() => {
    console.log("Initializing audio with volume:", volume);
    audioRef.current.volume = volume / 100;
  }, []);

  const play = async (song?: Song) => {
    console.log("Play function called with song:", song);
    
    if (song && (!currentSong || song.id !== currentSong.id)) {
      console.log("Setting new current song:", song);
      setCurrentSong(song);
      try {
        let audioUrl: string;
        
        // Vérifier d'abord si le fichier est disponible hors-ligne
        const offlineBlob = await getOfflineAudio(song.url);
        if (offlineBlob) {
          console.log("Using offline audio file");
          audioUrl = URL.createObjectURL(offlineBlob);
        } else {
          console.log("Fetching audio from storage");
          try {
            audioUrl = await getAudioFile(song.url);
            
            // Télécharger pour utilisation hors-ligne avec les métadonnées
            await downloadAndStoreAudio(song.url, audioUrl, {
              title: song.title,
              artist: song.artist,
              duration: song.duration
            });
            
          } catch (error) {
            console.log("File not found in storage, attempting to store it first");
            if (typeof song.url !== 'string') {
              throw new Error('Invalid audio file URL');
            }
            await storeAudioFile(song.url, song.url);
            audioUrl = await getAudioFile(song.url);
          }
        }

        if (!audioUrl) {
          throw new Error('Fichier audio non trouvé');
        }

        audioRef.current.src = audioUrl;
        console.log("Set audio source to:", audioUrl);
        
        // Reset the audio element
        audioRef.current.currentTime = 0;
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("Audio playback started successfully");
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
        toast.error("Impossible de lire ce fichier audio. Il n'est peut-être plus disponible.");
        setCurrentSong(null);
        setIsPlaying(false);
      }
    } else if (audioRef.current) {
      try {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("Resuming audio playback");
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
      console.log("Toggling favorite for song:", song);
      const audioFile = await getAudioFile(song.url);
      if (!audioFile) {
        toast.error("Le fichier audio n'est pas disponible");
        return;
      }

      // Vérifier si la chanson est déjà dans les favoris avec le même titre et artiste
      const isFavorite = favorites.some(f => 
        f.title.toLowerCase() === song.title.toLowerCase() && 
        f.artist?.toLowerCase() === song.artist?.toLowerCase()
      );
      
      if (isFavorite) {
        // Si la chanson est déjà dans les favoris, on la retire
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
      storeAudioFile(favoriteId, audioFile);
      
      // Créer d'abord l'entrée dans la table songs
      const { data: songData, error: songError } = await supabase
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

      console.log("Song entry created:", songData);

      // Mettre à jour les stats
      const { data: existingStat, error: fetchError } = await supabase
        .from('favorite_stats')
        .select('*')
        .eq('song_id', favoriteId)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching stats:", fetchError);
        return;
      }

      console.log("Existing stat:", existingStat);

      if (existingStat) {
        const { error: updateError } = await supabase
          .from('favorite_stats')
          .update({ 
            count: existingStat.count + 1,
            last_updated: new Date().toISOString()
          })
          .eq('song_id', favoriteId);

        if (updateError) {
          console.error("Error updating stats:", updateError);
          toast.error("Erreur lors de la mise à jour des statistiques");
        } else {
          console.log("Stats updated successfully");
        }
      } else {
        const { error: insertError } = await supabase
          .from('favorite_stats')
          .insert({
            song_id: favoriteId,
            count: 1,
            last_updated: new Date().toISOString()
          });

        if (insertError) {
          console.error("Error inserting stats:", insertError);
          toast.error("Erreur lors de l'ajout des statistiques");
        } else {
          console.log("Stats inserted successfully");
        }
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
      console.log("Audio started playing");
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log("Audio paused");
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
