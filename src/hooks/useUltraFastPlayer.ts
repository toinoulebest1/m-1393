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

  // Préchargement intelligent réactivé
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    // Annuler le timeout précédent
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Précharger après 2 secondes de lecture
    preloadTimeoutRef.current = window.setTimeout(() => {
      // Prédire et précharger
      const predictions = predictNextSongs(currentSong, queue);
      if (predictions.length > 0) {
        console.log("🔮 Préchargement prédictions:", predictions.length);
        preloadPredictedSongs(predictions.slice(0, 2)); // 2 premières prédictions
      }

      // Précharger la queue
      if (queue.length > 0) {
        const nextInQueue = queue[0];
        console.log("📋 Préchargement queue:", nextInQueue.title);
        preloadPredictedSongs([nextInQueue]);
      }
    }, 2000);

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [currentSong, isPlaying, queue, predictNextSongs, preloadPredictedSongs]);

  return {
    getCacheStats: () => ({ size: 0, maxSize: 0, entries: [] })
  };
};