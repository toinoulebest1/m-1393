import { useState, useCallback } from 'react';
import { Song } from '@/types/player';
import { toast } from 'sonner';

interface UsePlayerQueueProps {
  currentSong: Song | null;
  isChangingSong: boolean;
  setIsChangingSong: (value: boolean) => void;
  play: (song: Song) => Promise<void>;
}

export const usePlayerQueue = ({
  currentSong,
  isChangingSong,
  setIsChangingSong,
  play
}: UsePlayerQueueProps) => {
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
    const savedSong = localStorage.getItem('currentSong');
    return savedSong ? [JSON.parse(savedSong)] : [];
  });
  
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
    setShuffleMode(prev => !prev);
  }, []);

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
    
    console.log("=== NEXT SONG DEBUG ===");
    console.log("Current song:", currentSong?.title, "ID:", currentSong?.id);
    console.log("Queue length:", queue.length);
    console.log("Queue songs:", queue.map(s => `${s.title} (${s.id})`));
    
    if (!currentSong || queue.length === 0) {
      console.log("No current song or queue is empty");
      return;
    }
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    console.log("Current index in queue:", currentIndex);
    
    if (currentIndex === -1) {
      console.log("Current song not found in queue");
      console.log("Trying to find song by title/artist...");
      
      // Essayer de trouver par titre et artiste si l'ID ne correspond pas
      const fallbackIndex = queue.findIndex(song => 
        song.title === currentSong.title && song.artist === currentSong.artist
      );
      
      if (fallbackIndex !== -1) {
        console.log("Found song by title/artist at index:", fallbackIndex);
        const nextIndex = fallbackIndex + 1;
        if (nextIndex < queue.length) {
          console.log(`Playing next song: ${queue[nextIndex].title}`);
          await play(queue[nextIndex]);
          return;
        }
      }
      
      console.log("Could not find current song in queue, playing first song");
      if (queue.length > 0) {
        await play(queue[0]);
      }
      return;
    }
    
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      console.log(`Playing next song: ${queue[nextIndex].title}`);
      await play(queue[nextIndex]);
    } else {
      console.log("End of queue reached");
      if (repeatMode === 'all' && queue.length > 0) {
        console.log("Repeating playlist from beginning");
        await play(queue[0]);
      } else {
        toast.info("Fin de la playlist");
      }
    }
    console.log("=====================");
  }, [currentSong, isChangingSong, queue, play, repeatMode]);

  const previousSong = useCallback(async () => {
    if (isChangingSong) {
      console.log("Changement de chanson déjà en cours, ignorer previousSong()");
      return;
    }
    
    console.log("=== PREVIOUS SONG DEBUG ===");
    console.log("Current song:", currentSong?.title, "ID:", currentSong?.id);
    console.log("Queue length:", queue.length);
    
    if (!currentSong || queue.length === 0) {
      console.log("No current song or queue is empty");
      return;
    }
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    console.log("Current index in queue:", currentIndex);
    
    if (currentIndex === -1) {
      console.log("Current song not found in queue");
      
      // Essayer de trouver par titre et artiste si l'ID ne correspond pas
      const fallbackIndex = queue.findIndex(song => 
        song.title === currentSong.title && song.artist === currentSong.artist
      );
      
      if (fallbackIndex !== -1) {
        console.log("Found song by title/artist at index:", fallbackIndex);
        if (fallbackIndex > 0) {
          console.log(`Playing previous song: ${queue[fallbackIndex - 1].title}`);
          await play(queue[fallbackIndex - 1]);
          return;
        }
      }
      
      console.log("Could not find current song in queue, playing last song");
      if (queue.length > 0) {
        await play(queue[queue.length - 1]);
      }
      return;
    }
    
    if (currentIndex > 0) {
      console.log(`Playing previous song: ${queue[currentIndex - 1].title}`);
      await play(queue[currentIndex - 1]);
    } else {
      console.log("Already at first track");
      if (repeatMode === 'all' && queue.length > 0) {
        console.log("Going to last song in playlist");
        await play(queue[queue.length - 1]);
      } else {
        toast.info("Déjà au début de la playlist");
      }
    }
    console.log("=========================");
  }, [currentSong, isChangingSong, queue, play, repeatMode]);

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
