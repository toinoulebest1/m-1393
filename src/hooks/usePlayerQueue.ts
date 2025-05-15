
import { useState, useCallback } from 'react';
import { Song } from '@/types/player';
import { toast } from 'sonner';

interface UsePlayerQueueProps {
  currentSong: Song | null;
  isChangingSong: boolean;
  setIsChangingSong: (value: boolean) => void;
}

export const usePlayerQueue = ({
  currentSong,
  isChangingSong,
  setIsChangingSong
}: UsePlayerQueueProps) => {
  // État de la file d'attente
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
  
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');

  const setQueue = useCallback((songs: Song[]) => {
    setQueueRaw(songs);
    localStorage.setItem('queue', JSON.stringify(songs));
  }, []);

  const addToQueue = useCallback((song: Song) => {
    setQueueRaw(prevQueue => {
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
    
    setIsChangingSong(true);
    
    if (!currentSong || queue.length === 0) {
      console.log("No current song or queue is empty");
      setIsChangingSong(false);
      return;
    }
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    if (currentIndex === -1) {
      console.log("Current song not found in queue");
      setIsChangingSong(false);
      return;
    }
    
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      // Next song will be handled by the play function in useAudioControl
      // This is just a placeholder for the queue logic
      console.log(`Next song in queue: ${queue[nextIndex].title}`);
    } else {
      console.log("End of queue reached");
      setIsChangingSong(false);
    }
  }, [currentSong, isChangingSong, queue, setIsChangingSong]);

  const previousSong = useCallback(async () => {
    if (isChangingSong) {
      console.log("Changement de chanson déjà en cours, ignorer previousSong()");
      return;
    }
    
    setIsChangingSong(true);
    
    if (!currentSong || queue.length === 0) {
      console.log("No current song or queue is empty");
      setIsChangingSong(false);
      return;
    }
    
    const currentIndex = queue.findIndex(song => song.id === currentSong.id);
    if (currentIndex === -1) {
      console.log("Current song not found in queue");
      setIsChangingSong(false);
      return;
    }
    
    // Previous song handling will be done in useAudioControl
    // This is just queue-related logic
    if (currentIndex > 0) {
      console.log(`Previous song in queue: ${queue[currentIndex - 1].title}`);
    } else {
      console.log("Already at first track");
      setIsChangingSong(false);
    }
  }, [currentSong, isChangingSong, queue, setIsChangingSong]);

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
