import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getAudioFile } from '@/utils/storage';
import { supabase } from '@/integrations/supabase/client';
import { updateMediaSessionMetadata } from '@/utils/mediaSession';

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
  bitrate?: string;
  genre?: string;
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
  isChangingSong: boolean;
  stopCurrentSong: () => void;
  setQueue: (songs: Song[]) => void;
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
  refreshCurrentSong: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);
const globalAudio = new Audio();

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement>(globalAudio);
  const nextAudioRef = useRef<HTMLAudioElement>(new Audio());
  const overlapTimeRef = useRef(3);
  const fadingRef = useRef(false);
  const fadeIntervalRef = useRef<number | null>(null);
  const [nextSongPreloaded, setNextSongPreloaded] = useState(false);
  const [isChangingSong, setIsChangingSong] = useState(false);
  const changeTimeoutRef = useRef<number | null>(null);

  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    const savedSong = localStorage.getItem('currentSong');
    return savedSong ? JSON.parse(savedSong) : null;
  });

  const [queue, setQueueRaw] = useState<Song[]>(() => {
    const savedQueue = localStorage.getItem('queue');
    if (savedQueue) {
      try {
        return JSON.parse(savedQueue);
      } catch (err) {
        return [];
      }
    }
    const savedSong = localStorage.getItem('currentSong');
    return savedSong ? [JSON.parse(savedSong)] : [];
  });

  const [savedProgress, setSavedProgress] = useState(() => {
    const saved = localStorage.getItem('audioProgress');
    return saved ? parseFloat(saved) : 0;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(savedProgress);
  const [volume, setVolume] = useState(70);
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
  const [preferences, setPreferences] = useState({
    crossfadeEnabled: false,
    crossfadeDuration: 3,
  });

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (audioRef.current && !isNaN(audioRef.current.currentTime)) {
        localStorage.setItem('audioProgress', audioRef.current.currentTime.toString());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const restorePlayback = async () => {
      const savedSong = localStorage.getItem('currentSong');
      const savedProgress = localStorage.getItem('audioProgress');
      
      if (savedSong) {
        const song = JSON.parse(savedSong);
        try {
          const audioUrl = await getAudioFile(song.url);
          if (!audioUrl) return;

          audioRef.current.src = audioUrl;
          audioRef.current.load();
          
          if (savedProgress) {
            audioRef.current.currentTime = parseFloat(savedProgress);
          }

          setCurrentSong(song);
          // FIX: Only setQueueRaw can accept a function, not setQueue.
          setQueueRaw(prevQueue => {
            if (!prevQueue.some(s => s.id === song.id)) {
              return [song, ...prevQueue];
            }
            return prevQueue;
          });
        } catch (error) {
          console.error("Erreur lors de la restauration de la lecture:", error);
          localStorage.removeItem('currentSong');
          localStorage.removeItem('audioProgress');
        }
      }
    };

    restorePlayback();
  }, []);

  useEffect(() => {
    if (currentSong) {
      localStorage.setItem('currentSong', JSON.stringify(currentSong));
    }
  }, [currentSong]);

  useEffect(() => {
    localStorage.setItem('queue', JSON.stringify(queue));
  }, [queue]);

  // "setQueue" doit recevoir un tableau, pas une fonction
  const setQueue = (songs: Song[]) => {
    setQueueRaw(songs);
    localStorage.setItem('queue', JSON.stringify(songs));
  };

  const preloadNextSong = async () => {
    if (!currentSong || queue.length === 0) return;
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    if (currentIndex === -1 || currentIndex >= queue.length - 1) return;
    
    const nextSong = queue[currentIndex + 1];
    if (!nextSong) return;

    console.log("Préchargement de la prochaine chanson:", nextSong.title);
    
    try {
      const audioUrl = await getAudioFile(nextSong.url);
      if (!audioUrl) {
        throw new Error("URL audio non disponible");
      }

      nextAudioRef.current.src = audioUrl;
      nextAudioRef.current.preload = "auto";
      nextAudioRef.current.load();
      nextAudioRef.current.volume = 0;
      
      const canPlayHandler = () => {
        console.log("Préchargement réussi et audio prêt à jouer");
        setNextSongPreloaded(true);
        nextAudioRef.current.removeEventListener('canplaythrough', canPlayHandler);
      };
      
      nextAudioRef.current.addEventListener('canplaythrough', canPlayHandler);
      
      setTimeout(() => {
        if (!nextSongPreloaded) {
          console.log("Timeout du préchargement, marquage comme prêt par sécurité");
          setNextSongPreloaded(true);
          nextAudioRef.current.removeEventListener('canplaythrough', canPlayHandler);
        }
      }, 3000);
      
    } catch (error) {
      console.error("Erreur lors du préchargement:", error);
      setNextSongPreloaded(false);
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
          file_path: song.url,
          duration: song.duration,
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

  const calculateDurationInSeconds = (duration: string): number => {
    if (!duration) return 0;
    
    try {
      if (duration.includes(':')) {
        const [minutes, seconds] = duration.split(':').map(Number);
        return (minutes * 60) + seconds;
      }
      return parseInt(duration);
    } catch (error) {
      console.error("Erreur lors du calcul de la durée:", error);
      return 0;
    }
  };

  const updateListeningStats = async (song: Song, actualListeningTime: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: existingStats, error: statsError } = await supabase
        .from('listening_stats')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (statsError) {
        console.error("Erreur lors de la récupération des statistiques:", statsError);
        return;
      }

      const currentHour = new Date().getHours();
      const currentPeriod = `${currentHour}:00-${currentHour + 1}:00`;
      
      let peakHours = existingStats?.peak_hours || {};
      peakHours[currentPeriod] = (peakHours[currentPeriod] || 0) + 1;

      const favoritePeriods = Object.entries(peakHours)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([period, count]) => ({
          period,
          count
        }));

      const previousTotalTime = existingStats?.total_listening_time || 0;
      const newTotalTime = previousTotalTime + actualListeningTime;

      if (!existingStats) {
        await supabase
          .from('listening_stats')
          .insert({
            user_id: session.user.id,
            total_listening_time: actualListeningTime,
            tracks_played: 1,
            peak_hours: peakHours,
            favorite_periods: favoritePeriods
          });
      } else {
        await supabase
          .from('listening_stats')
          .update({
            total_listening_time: newTotalTime,
            tracks_played: existingStats.tracks_played + 1,
            peak_hours: peakHours,
            favorite_periods: favoritePeriods
          })
          .eq('user_id', session.user.id);
      }

      console.log(`Temps d'écoute mis à jour: ${actualListeningTime} secondes, Total: ${newTotalTime} secondes`);
    } catch (error) {
      console.error("Erreur lors de la mise à jour des statistiques:", error);
    }
  };

  const play = async (song?: Song) => {
    if (isChangingSong) {
      console.log("Changement de chanson déjà en cours, ignorer l'appel");
      return;
    }
    
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    
    if (fadingRef.current) {
      console.log("Annulation de la transition en cours");
      fadingRef.current = false;
    }

    if (changeTimeoutRef.current) {
      clearTimeout(changeTimeoutRef.current);
      changeTimeoutRef.current = null;
    }

    if (song && (!currentSong || song.id !== currentSong.id)) {
      setIsChangingSong(true);
      
      setCurrentSong(song);
      localStorage.setItem('currentSong', JSON.stringify(song));
      setNextSongPreloaded(false);
      
      if ('mediaSession' in navigator) {
        updateMediaSessionMetadata(song);
      }

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

        audioRef.current.src = audioUrl;
        audioRef.current.currentTime = 0;
        
        audioRef.current.preload = "auto";
        
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
            audioRef.current.volume = volume / 100;
            console.log("Lecture démarrée avec succès:", song.title);
            
            setTimeout(() => preloadNextSong(), 1000);
            
            changeTimeoutRef.current = window.setTimeout(() => {
              setIsChangingSong(false);
              changeTimeoutRef.current = null;
            }, 1200);
          }).catch(error => {
            console.error("Error starting playback:", error);
            setIsPlaying(false);
            setIsChangingSong(false);
          });
        }
      } catch (error) {
        console.error("Error playing audio:", error);
        toast.error("Impossible de lire ce titre");
        setCurrentSong(null);
        localStorage.removeItem('currentSong');
        setIsPlaying(false);
        setIsChangingSong(false);
      }
    } else if (audioRef.current) {
      try {
        audioRef.current.volume = volume / 100;
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
    if (!currentSong) return null;
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    if (currentIndex === -1) return null;
    
    if (shuffleMode) {
      const remainingSongs = queue.slice(currentIndex + 1);
      if (remainingSongs.length === 0) return null;
      const randomIndex = Math.floor(Math.random() * remainingSongs.length);
      return remainingSongs[randomIndex];
    }
    
    return currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null;
  };

  const nextSong = async () => {
    if (isChangingSong) {
      console.log("Changement de chanson déjà en cours, ignorer nextSong()");
      return;
    }
    
    setIsChangingSong(true);
    
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    
    fadingRef.current = false;
    
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.volume = 0;
    }
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
    
    console.log("Executing nextSong function");
    
    if (!currentSong || queue.length === 0) {
      console.log("No current song or queue is empty");
      setIsChangingSong(false);
      return;
    }
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    console.log(`Current song index: ${currentIndex}, Queue length: ${queue.length}`);
    
    if (currentIndex === -1) {
      console.log("Current song not found in queue");
      setIsChangingSong(false);
      return;
    }
    
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      const nextTrack = queue[nextIndex];
      console.log(`Playing next track: ${nextTrack.title} by ${nextTrack.artist}`);
      
      if (nextSongPreloaded && nextAudioRef.current.src) {
        console.log("Utilisation de l'audio préchargé pour une transition plus rapide");
        
        try {
          const tempAudio = audioRef.current;
          audioRef.current = nextAudioRef.current;
          nextAudioRef.current = tempAudio;
          
          nextAudioRef.current.pause();
          nextAudioRef.current.src = '';
          nextAudioRef.current.load();
          
          setCurrentSong(nextTrack);
          localStorage.setItem('currentSong', JSON.stringify(nextTrack));
          setNextSongPreloaded(false);
          
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              setIsPlaying(true);
              
              setTimeout(() => preloadNextSong(), 1000);
              
              setTimeout(() => {
                setIsChangingSong(false);
              }, 1000);
            }).catch(error => {
              console.error("Error playing next track:", error);
              setIsPlaying(false);
              setIsChangingSong(false);
              
              play(nextTrack);
            });
          }
        } catch (error) {
          console.error("Error during optimized track change:", error);
          setIsChangingSong(false);
          
          play(nextTrack);
        }
      } else {
        play(nextTrack);
      }
      
      if ('mediaSession' in navigator && nextTrack) {
        updateMediaSessionMetadata(nextTrack);
      }
      
      toast.success(`Lecture de : ${nextTrack.title}`);
      
    } else if (repeatMode === 'all' && queue.length > 0) {
      const firstTrack = queue[0];
      console.log(`Repeating playlist from beginning: ${firstTrack.title}`);
      toast.success(`Retour au début de la playlist : ${firstTrack.title}`);
      play(firstTrack);
      if ('mediaSession' in navigator && firstTrack) {
        updateMediaSessionMetadata(firstTrack);
      }
    } else {
      console.log("End of queue reached with no repeat");
      toast.info("Fin de la liste de lecture");
      audioRef.current.pause();
      setIsPlaying(false);
      setProgress(0);
      setIsChangingSong(false);
    }
  };

  const previousSong = async () => {
    if (isChangingSong) {
      console.log("Changement de chanson déjà en cours, ignorer previousSong()");
      return;
    }
    
    setIsChangingSong(true);
    
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    
    fadingRef.current = false;
    
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.volume = 0;
    }
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
    
    console.log("Executing previousSong function");
    
    if (!currentSong || queue.length === 0) {
      console.log("No current song or queue is empty");
      setIsChangingSong(false);
      return;
    }
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    console.log(`Current song index: ${currentIndex}, Total songs in queue: ${queue.length}`);
    
    if (currentIndex === -1) {
      console.log("Current song not found in queue");
      setIsChangingSong(false);
      return;
    }
    
    if (audioRef.current.currentTime > 3) {
      console.log("Restarting current song from beginning");
      toast.info("Redémarrage de la chanson");
      audioRef.current.currentTime = 0;
      if (!isPlaying) {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            setIsChangingSong(false);
          })
          .catch(err => {
            console.error("Error playing audio:", err);
            setIsChangingSong(false);
          });
      } else {
        setIsChangingSong(false);
      }
      return;
    }
    
    if (currentIndex > 0) {
      const prevTrack = queue[currentIndex - 1];
      console.log(`Playing previous track: ${prevTrack.title} by ${prevTrack.artist}`);
      toast.success(`Lecture de : ${prevTrack.title}`);
      play(prevTrack);
      if ('mediaSession' in navigator && prevTrack) {
        updateMediaSessionMetadata(prevTrack);
      }
    } else if (repeatMode === 'all' && queue.length > 0) {
      const lastTrack = queue[queue.length - 1];
      console.log(`Looping to last track: ${lastTrack.title}`);
      toast.success(`Aller à la dernière piste : ${lastTrack.title}`);
      play(lastTrack);
      if ('mediaSession' in navigator && lastTrack) {
        updateMediaSessionMetadata(lastTrack);
      }
    } else {
      console.log("Already at first track, restarting");
      toast.info("Première piste de la liste");
      audioRef.current.currentTime = 0;
      if (!isPlaying) {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            setIsChangingSong(false);
          })
          .catch(err => {
            console.error("Error playing audio:", err);
            setIsChangingSong(false);
          });
      } else {
        setIsChangingSong(false);
      }
    }
  };

  const addToQueue = (song: Song) => {
    setQueueRaw(prevQueue => {
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

  const stopCurrentSong = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      
      fadingRef.current = false;
      
      console.log("Current song stopped immediately");
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
          overlapTimeRef.current = data.crossfade_duration || 3;
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
            overlapTimeRef.current = newData.crossfade_duration || 3;
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
    const loadFavorites = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        console.log("Chargement initial des favoris");

        const { data: favStats, error: favError } = await supabase
          .from('favorite_stats')
          .select('song_id')
          .eq('user_id', session.user.id);

        if (favError) throw favError;

        if (favStats && favStats.length > 0) {
          const { data: favoriteSongs, error: songsError } = await supabase
            .from('songs')
            .select('*')
            .in('id', favStats.map(row => row.song_id));

          if (songsError) throw songsError;

          if (favoriteSongs) {
            console.log("Favoris chargés:", favoriteSongs);
            const mappedSongs: Song[] = favoriteSongs.map(song => ({
              id: song.id,
              title: song.title,
              artist: song.artist || '',
              duration: song.duration || '0:00',
              url: song.file_path,
              imageUrl: song.image_url,
              bitrate: '320 kbps'
            }));
            setFavorites(mappedSongs);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des favoris:", error);
      }
    };

    loadFavorites();
  }, []);

  useEffect(() => {
    const setupRealtimeFavorites = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        console.log("Mise en place de l'écoute des favoris en temps réel");

        const channel = supabase
          .channel('favorite_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'favorite_stats',
              filter: `user_id=eq.${session.user.id}`
            },
            async (payload) => {
              console.log("Changement détecté dans les favoris:", payload);

              const { data: favStats } = await supabase
                .from('favorite_stats')
                .select('song_id')
                .eq('user_id', session.user.id);

              if (favStats && favStats.length > 0) {
                const { data: favoriteSongs } = await supabase
                  .from('songs')
                  .select('*')
                  .in('id', favStats.map(row => row.song_id));

                if (favoriteSongs) {
                  console.log("Mise à jour des favoris:", favoriteSongs);
                  const mappedSongs: Song[] = favoriteSongs.map(song => ({
                    id: song.id,
                    title: song.title,
                    artist: song.artist || '',
                    duration: song.duration || '0:00',
                    url: song.file_path,
                    imageUrl: song.image_url,
                    bitrate: '320 kbps'
                  }));
                  setFavorites(mappedSongs);
                }
              } else {
                setFavorites([]);
              }
            }
          )
          .subscribe();

        return () => {
          console.log("Nettoyage de l'écoute des favoris");
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error("Erreur lors de la configuration de l'écoute en temps réel:", error);
      }
    };

    setupRealtimeFavorites();
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;

    const handleTimeUpdate = () => {
      if (!audioRef.current || !currentSong || !preferences.crossfadeEnabled || fadingRef.current) {
        return;
      }

      const timeLeft = audioRef.current.duration - audioRef.current.currentTime;
      
      if (timeLeft <= overlapTimeRef.current && timeLeft > 0 && !fadingRef.current) {
        console.log(`Démarrage du fondu enchaîné, temps restant: ${timeLeft.toFixed(2)}s, durée du fondu: ${overlapTimeRef.current}s`);
        
        const nextSong = getNextSong();
        if (!nextSong) {
          console.log("Pas de chanson suivante disponible");
          return;
        }

        fadingRef.current = true;
        
        const alertElement = document.getElementById('next-song-alert');
        const titleElement = document.getElementById('next-song-title');
        const artistElement = document.getElementById('next-song-artist');

        if (alertElement && titleElement && artistElement) {
          titleElement.textContent = nextSong.title;
          artistElement.textContent = nextSong.artist;
          alertElement.classList.remove('opacity-0', 'translate-y-2');
          alertElement.classList.add('opacity-100', 'translate-y-0');

          setTimeout(() => {
            alertElement.classList.add('opacity-0', 'translate-y-2');
            alertElement.classList.remove('opacity-100', 'translate-y-0');
          }, 3000);
        }

        if (!nextAudioRef.current.src || !nextSongPreloaded) {
          console.log("La prochaine chanson n'est pas préchargée correctement, préchargement forcé");
          preloadNextSong().then(() => {
            startCrossfade(timeLeft, nextSong);
          });
        } else {
          startCrossfade(timeLeft, nextSong);
        }
      }
    };
    
    const startCrossfade = (timeLeft: number, nextSong: Song) => {
      console.log(`Début du fondu enchaîné pour ${nextSong.title}`);
      
      nextAudioRef.current.volume = 0;
      const playPromise = nextAudioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log("Lecture de la prochaine chanson démarrée avec succès");
          
          const fadeDuration = Math.min(timeLeft * 1000, overlapTimeRef.current * 1000);
          const steps = Math.max(50, fadeDuration / 20);
          const intervalTime = fadeDuration / steps;
          const volumeStep = (volume / 100) / steps;
          
          console.log(`Paramètres du fondu: durée=${fadeDuration}ms, étapes=${steps}, intervalleTemps=${intervalTime}ms, pas de volume=${volumeStep}`);
          
          let currentOutVolume = audioRef.current.volume;
          let currentInVolume = 0;
          let stepCount = 0;
          
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
          }
          
          fadeIntervalRef.current = window.setInterval(() => {
            stepCount++;
            
            if (currentOutVolume > 0 || currentInVolume < (volume / 100)) {
              currentOutVolume = Math.max(0, currentOutVolume - volumeStep);
              currentInVolume = Math.min(volume / 100, currentInVolume + volumeStep);
              
              if (audioRef.current) audioRef.current.volume = currentOutVolume;
              if (nextAudioRef.current) nextAudioRef.current.volume = currentInVolume;
              
              if (stepCount % 10 === 0) {
                console.log(`Progression du fondu: out=${Math.round(currentOutVolume*100)}%, in=${Math.round(currentInVolume*100)}%, étape=${stepCount}`);
              }
            } else {
              console.log("Fondu enchaîné terminé, passage à la chanson suivante");
              
              if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
              }
              
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
              
              const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
              const nextTrack = queue[currentIndex + 1];
              if (nextTrack) {
                const tempAudio = audioRef.current;
                audioRef.current = nextAudioRef.current;
                nextAudioRef.current = tempAudio;
                nextAudioRef.current.src = '';
                setCurrentSong(nextTrack);
                localStorage.setItem('currentSong', JSON.stringify(nextTrack));
                setNextSongPreloaded(false);
                fadingRef.current = false;
                
                setTimeout(() => preloadNextSong(), 1000);
              }
            }
          }, intervalTime);
        }).catch(error => {
          console.error("Erreur lors du démarrage du fondu:", error);
          fadingRef.current = false;
          toast.error("Erreur lors de la transition entre les pistes");
        });
      }
    };

    const handleEnded = () => {
      console.log("Chanson terminée, fondu en cours:", fadingRef.current);
      
      if (!fadingRef.current) {
        console.log("Lecture terminée naturellement sans crossfade");
        setProgress(0);
        
        if (repeatMode === 'one') {
          console.log("Répétition de la chanson actuelle");
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(err => console.error("Erreur lors de la répétition:", err));
        } else {
          const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
          const nextTrack = queue[currentIndex + 1];
          
          if (nextTrack) {
            console.log("Passage à la chanson suivante:", nextTrack.title);
            play(nextTrack);
          } else if (repeatMode === 'all' && queue.length > 0) {
            console.log("Répétition de la playlist depuis le début");
            play(queue[0]);
          } else {
            console.log("Fin de la playlist");
            setIsPlaying(false);
          }
        }
      }
    };

    const handleTimeUpdateProgress = () => {
      if (audioRef.current && !isNaN(audioRef.current.duration)) {
        const percentage = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setProgress(percentage);
        
        if (preferences.crossfadeEnabled && !fadingRef.current && currentSong) {
          const timeLeft = audioRef.current.duration - audioRef.current.currentTime;
          if (timeLeft <= 0.5 && overlapTimeRef.current > 0) {
            console.log(`Forçage du crossfade car temps restant très court: ${timeLeft.toFixed(2)}s`);
            handleTimeUpdate();
          }
        }
      }
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
      
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, [currentSong, nextSongPreloaded, queue, play, repeatMode, preferences.crossfadeEnabled, volume]);

  useEffect(() => {
    console.log(`Préférences crossfade mises à jour: activé=${preferences.crossfadeEnabled}, durée=${preferences.crossfadeDuration}`);
    overlapTimeRef.current = preferences.crossfadeDuration || 3;
  }, [preferences.crossfadeEnabled, preferences.crossfadeDuration]);

  useEffect(() => {
    if (!audioRef.current) return;

    let startTime: number | null = null;
    let accumulatedTime = 0;

    const handleTimeUpdate = () => {
      if (!currentSong) return;

      if (startTime === null && !audioRef.current.paused) {
        startTime = Date.now();
      }
    };

    const handlePause = () => {
      if (startTime !== null) {
        accumulatedTime += (Date.now() - startTime) / 1000;
        startTime = null;
      }
    };

    const handleEnded = async () => {
      if (startTime !== null) {
        accumulatedTime += (Date.now() - startTime) / 1000;
      }
      if (currentSong && accumulatedTime > 0) {
        await updateListeningStats(currentSong, Math.round(accumulatedTime));
      }
      accumulatedTime = 0;
      startTime = null;
    };

    const handleSeeked = () => {
      if (!audioRef.current.paused) {
        startTime = Date.now();
      }
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('pause', handlePause);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('seeked', handleSeeked);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('seeked', handleSeeked);
      }
    };
  }, [currentSong]);

  const refreshCurrentSong = () => {
    if (currentSong) {
      const fetchUpdatedSong = async () => {
        console.log("Rafraîchissement des métadonnées de la chanson:", currentSong.id);
        const { data, error } = await supabase
          .from('songs')
          .select('*')
          .eq('id', currentSong.id)
          .single();

        if (data && !error) {
          setCurrentSong({
            ...currentSong,
            title: data.title,
            artist: data.artist,
            imageUrl: data.image_url,
            genre: data.genre,
            duration: data.duration
          });
        }
      };

      fetchUpdatedSong();
    }
  };

  return (
    <PlayerContext.Provider value={{
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
      isChangingSong,
      stopCurrentSong,
      setQueue,
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
      refreshCurrentSong,
    }}>
      {children}
      <div 
        id="next-song-alert"
        className="fixed bottom-28 right-4 bg-spotify-dark/90 text-white p-3 rounded-lg shadow-lg transition-all duration-300 transform opacity-0 translate-y-2 z-50"
      >
        <p className="text-xs text-spotify-neutral">À suivre :</p>
        <p id="next-song-title" className="font-medium"></p>
        <p id="next-song-artist" className="text-sm text-spotify-neutral"></p>
      </div>
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

export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayerContext must be used within a PlayerProvider");
  }
  return context;
};

export default PlayerProvider;
