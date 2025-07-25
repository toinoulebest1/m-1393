
import { useEffect, useRef } from 'react';
import { Song } from '@/types/player';
import { useIntelligentPreloader } from './useIntelligentPreloader';
// import { memoryCache } from '@/utils/memoryCache'; // DÉSACTIVÉ

interface UseUltraFastPlayerProps {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
}

export const useUltraFastPlayer = ({
  currentSong,
  queue,
  isPlaying
}: UseUltraFastPlayerProps) => {
  const { recordTransition, predictNextSongs, preloadPredictedSongs } = useIntelligentPreloader();
  const previousSongRef = useRef<Song | null>(null);
  const preloadTimeoutRef = useRef<number | null>(null);

  // Enregistrer les transitions entre chansons
  useEffect(() => {
    if (currentSong && previousSongRef.current && currentSong.id !== previousSongRef.current.id) {
      console.log("🔄 Transition détectée:", previousSongRef.current.title, "→", currentSong.title);
      recordTransition(previousSongRef.current, currentSong);
    }
    previousSongRef.current = currentSong;
  }, [currentSong, recordTransition]);

  // Préchargement intelligent quand une chanson commence
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    // Annuler le préchargement précédent
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Démarrer le préchargement après un délai ultra-court
    preloadTimeoutRef.current = window.setTimeout(async () => {
      console.log("🚀 Démarrage préchargement intelligent");
      
      const predictions = predictNextSongs(currentSong, queue);
      if (predictions.length > 0) {
        await preloadPredictedSongs(predictions);
      }
      
      // Précharger aussi les 3 chansons suivantes dans la queue
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
      if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
        const nextInQueue = queue.slice(currentIndex + 1, currentIndex + 4);
        console.log("🎵 Préchargement queue:", nextInQueue.map(s => s.title));
        
        // Cache mémoire DÉSACTIVÉ - préchargement batch désactivé
        // await memoryCache.preloadBatch(nextInQueue.map(s => s.url));
      }
    }, 100); // 100ms pour laisser le temps à la chanson de démarrer

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [currentSong, isPlaying, queue, predictNextSongs, preloadPredictedSongs]);

  // Préchargement agressif au changement de queue
  useEffect(() => {
    if (queue.length === 0) return;

    // Précharger les 5 premières chansons de la queue
    const timeout = setTimeout(async () => {
      const firstSongs = queue.slice(0, 5);
      // Cache mémoire DÉSACTIVÉ - préchargement batch désactivé
      // await memoryCache.preloadBatch(firstSongs.map(s => s.url));
    }, 500); // Délai plus long pour ne pas interférer avec la lecture

    return () => clearTimeout(timeout);
  }, [queue]);

  return {
    // Cache mémoire DÉSACTIVÉ
    getCacheStats: () => ({ size: 0, maxSize: 0, entries: [] })
  };
};
