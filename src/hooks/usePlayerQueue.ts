import { useState, useCallback, useEffect } from 'react';
import { Song } from '@/types/player';
import { toast } from 'sonner';

// Helper pour mélanger un tableau
const shuffleArray = (array: Song[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

interface UsePlayerQueueProps {
  currentSong: Song | null;
  play: (song: Song) => Promise<void>;
  history: Song[];
  setHistory: (history: Song[] | ((prevHistory: Song[]) => Song[])) => void;
}

export const usePlayerQueue = ({
  currentSong,
  play,
  history,
  setHistory,
}: UsePlayerQueueProps) => {
  // --- ÉTATS ---
  const [queue, setQueueInternal] = useState<Song[]>(() => {
    try {
      const savedQueue = localStorage.getItem('queue');
      return savedQueue ? JSON.parse(savedQueue) : [];
    } catch {
      return [];
    }
  });

  const [shuffledQueue, setShuffledQueue] = useState<Song[]>([]);
  
  const [shuffleMode, setShuffleModeInternal] = useState<boolean>(() => {
    const savedMode = localStorage.getItem('shuffleMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  const [repeatMode, setRepeatModeInternal] = useState<'none' | 'one' | 'all'>(() => {
    const savedMode = localStorage.getItem('repeatMode');
    return savedMode ? JSON.parse(savedMode) : 'none';
  });

  // --- SYNCHRONISATION ET PERSISTANCE ---

  // Recalculer la file mélangée si la file principale ou le mode shuffle change
  useEffect(() => {
    if (shuffleMode) {
      setShuffledQueue(shuffleArray(queue));
    } else {
      setShuffledQueue([]); // Vider si le mode shuffle est désactivé
    }
  }, [queue, shuffleMode]);

  // --- FONCTIONS PUBLIQUES ---

  const setQueue = useCallback((newQueue: Song[] | ((prevQueue: Song[]) => Song[])) => {
    setQueueInternal(prev => {
      const resolvedQueue = typeof newQueue === 'function' ? newQueue(prev) : newQueue;
      localStorage.setItem('queue', JSON.stringify(resolvedQueue));
      return resolvedQueue;
    });
  }, []);

  const addToQueue = useCallback((song: Song) => {
    setQueue(prev => [...prev, song]);
    toast.info(`"${song.title}" ajoutée à la file d'attente.`);
  }, [setQueue]);

  const setShuffleMode = useCallback((mode: boolean) => {
    setShuffleModeInternal(mode);
    localStorage.setItem('shuffleMode', JSON.stringify(mode));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleMode(!shuffleMode);
    toast.info(`Lecture aléatoire ${!shuffleMode ? 'activée' : 'désactivée'}`);
  }, [shuffleMode, setShuffleMode]);

  const setRepeatMode = useCallback((mode: 'none' | 'one' | 'all') => {
    setRepeatModeInternal(mode);
    localStorage.setItem('repeatMode', JSON.stringify(mode));
  }, []);

  const toggleRepeat = useCallback(() => {
    const modes: ('none' | 'one' | 'all')[] = ['none', 'one', 'all'];
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(nextMode);
    if (nextMode === 'one') toast.info("Répéter la piste actuelle");
    if (nextMode === 'all') toast.info("Répéter la playlist");
    if (nextMode === 'none') toast.info("Répétition désactivée");
  }, [repeatMode, setRepeatMode]);

  const nextSong = useCallback(async () => {
    const activeQueue = shuffleMode ? shuffledQueue : queue;
    if (!currentSong || activeQueue.length === 0) {
      toast.info("La file d'attente est vide.");
      return;
    }

    const currentIndex = activeQueue.findIndex(song => song.id === currentSong.id);
    const nextIndex = currentIndex + 1;

    if (nextIndex < activeQueue.length) {
      await play(activeQueue[nextIndex]);
    } else {
      if (repeatMode === 'all') {
        await play(activeQueue[0]);
      } else {
        toast.info("Fin de la file d'attente.");
      }
    }
  }, [currentSong, queue, shuffledQueue, shuffleMode, repeatMode, play]);

  const previousSong = useCallback(async () => {
    if (history.length > 1) {
      const previous = history[history.length - 2];
      setHistory(h => h.slice(0, -1)); // Enlever la chanson actuelle de l'historique
      await play(previous);
    } else {
      toast.info("Pas de chanson précédente dans l'historique.");
    }
  }, [history, play, setHistory]);

  return {
    queue,
    setQueue,
    shuffledQueue,
    shuffleMode,
    setShuffleMode,
    repeatMode,
    setRepeatMode,
    addToQueue,
    toggleShuffle,
    toggleRepeat,
    nextSong,
    previousSong,
  };
};