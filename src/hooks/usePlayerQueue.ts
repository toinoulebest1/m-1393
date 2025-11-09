import { useState, useCallback } from 'react';
import { Song } from '@/types/player';
import { toast } from 'sonner';
import { useGenreBasedQueue } from './useGenreBasedQueue';

interface UsePlayerQueueProps {
  currentSong: Song | null;
  isChangingSong: boolean;
  setIsChangingSong: (value: boolean) => void;
  play: (song: Song) => Promise<void>;
  history: Song[];
  setHistory: (history: Song[] | ((prevHistory: Song[]) => Song[])) => void;
}

export const usePlayerQueue = ({
  currentSong,
  isChangingSong,
  setIsChangingSong,
  play,
  history,
  setHistory,
}: UsePlayerQueueProps) => {
  const { fetchSimilarSongsByGenre } = useGenreBasedQueue();
  
  // État de la file d'attente
  const [queue, setQueueInternal] = useState<Song[]>(() => {
    const savedQueue = localStorage.getItem('queue');
    if (savedQueue) {
      try {
        return JSON.parse(savedQueue);
      } catch (err) {
        return [];
      }
    }
    return [];
  });
  
  const [shuffledQueue, setShuffledQueue] = useState<Song[]>([]);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');

  // Create a properly typed setQueue function that accepts both arrays and callback functions
  const setQueue = useCallback((value: Song[] | ((prevQueue: Song[]) => Song[])) => {
    if (typeof value === 'function') {
      setQueueInternal(prevQueue => {
        const newQueue = value(prevQueue);
        localStorage.setItem('queue', JSON.stringify(newQueue));
        return newQueue;
      });
    } else {
      setQueueInternal(value);
      localStorage.setItem('queue', JSON.stringify(value));
    }
  }, []);

  const addToQueue = useCallback((song: Song) => {
    setQueueInternal(prevQueue => {
      const newQueue = [...prevQueue, song];
      localStorage.setItem('queue', JSON.stringify(newQueue));
      return newQueue;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleMode(prev => {
      const newShuffleMode = !prev;
      if (newShuffleMode) {
        // Activer le shuffle : mélanger la queue
        const newShuffledQueue = [...queue].sort(() => Math.random() - 0.5);
        setShuffledQueue(newShuffledQueue);
        toast.success("Lecture aléatoire activée");
      } else {
        // Désactiver le shuffle
        setShuffledQueue([]);
        toast.info("Lecture aléatoire désactivée");
      }
      return newShuffleMode;
    });
  }, [queue]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(current => {
      switch (current) {
        case 'none': return 'one';
        case 'one': return 'all';
        case 'all': return 'none';
      }
    });
  }, []);

  const nextSong = useCallback(async () => {
    if (isChangingSong) {
      console.log("Changement de chanson déjà en cours, ignorer nextSong()");
      return;
    }
    
    const activeQueue = shuffleMode ? shuffledQueue : queue;
    
    console.log("=== NEXT SONG DEBUG ===");
    console.log("Shuffle mode:", shuffleMode);
    console.log("Current song:", currentSong?.title, "ID:", currentSong?.id);
    console.log("Active Queue length:", activeQueue.length);
    
    if (!currentSong || activeQueue.length === 0) {
      console.log("No current song or queue is empty");
      return;
    }
    
    const currentIndex = activeQueue.findIndex(song => song.id === currentSong.id);
    console.log("Current index in active queue:", currentIndex);
    
    if (currentIndex === -1) {
      // Si la chanson n'est pas dans la file active (ex: jouée depuis la recherche)
      // On joue la première chanson de la file active
      if (activeQueue.length > 0) {
        await play(activeQueue[0]);
      }
      return;
    }
    
    const nextIndex = currentIndex + 1;
    if (nextIndex < activeQueue.length) {
      console.log(`Playing next song: ${activeQueue[nextIndex].title}`);
      await play(activeQueue[nextIndex]);
    } else {
      console.log("End of queue reached");
      if (repeatMode === 'all' && activeQueue.length > 0) {
        console.log("Repeating playlist from beginning");
        await play(activeQueue[0]);
      } else {
        toast.info("Fin de la playlist");
      }
    }
    console.log("=====================");
  }, [currentSong, isChangingSong, queue, shuffledQueue, shuffleMode, play, repeatMode, fetchSimilarSongsByGenre]);

  const previousSong = useCallback(async () => {
    if (isChangingSong) {
      console.log("Changement de chanson déjà en cours, ignorer previousSong()");
      return;
    }
    
    console.log("=== PREVIOUS SONG DEBUG ===");
    console.log("History length:", history.length);

    if (history.length > 1) {
      // L'historique contient [..., avant-dernière, dernière (actuelle)]
      // On veut jouer l'avant-dernière.
      const previousSongInHistory = history[history.length - 2];
      
      // On retire la chanson actuelle de l'historique pour ne pas la rajouter
      setHistory(h => h.slice(0, -1));

      await play(previousSongInHistory);
    } else {
      toast.info("Pas de chanson précédente dans l'historique");
    }

    console.log("=========================");
  }, [isChangingSong, history, play, setHistory]);

  const getNextSong = useCallback((): Song | null => {
    if (!currentSong || queue.length === 0) return null;
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    if (currentIndex === -1 || currentIndex + 1 >= queue.length) return null;
    
    return queue[currentIndex + 1];
  }, [currentSong, queue]);

  return {
    queue,
    setQueue,
    shuffleMode,
    setShuffleMode,
    repeatMode,
    setRepeatMode,
    addToQueue,
    toggleShuffle,
    toggleRepeat,
    nextSong,
    previousSong,
    getNextSong
  };
};