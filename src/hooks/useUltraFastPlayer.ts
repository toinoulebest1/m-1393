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

  // Préchargement intelligent basé sur le genre
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    // Annuler le timeout précédent
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Délai avant préchargement (éviter de charger trop tôt)
    preloadTimeoutRef.current = window.setTimeout(async () => {
      console.log("🧠 Préchargement intelligent basé sur le genre...");
      const predictions = await predictNextSongs(currentSong, queue);
      if (predictions.length > 0) {
        await preloadPredictedSongs(predictions);
      }
    }, 2000); // Attendre 2s après le début de la lecture

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [currentSong, isPlaying, queue, predictNextSongs, preloadPredictedSongs]);

  // Préchargement queue DÉSACTIVÉ
  useEffect(() => {
    console.log("⚠️ Préchargement de queue désactivé");
    return () => {};
  }, [queue]);

  return {
    getCacheStats: () => ({ size: 0, maxSize: 0, entries: [] })
  };
};