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

  // Préchargement intelligent DÉSACTIVÉ pour éviter les chargements multiples
  useEffect(() => {
    console.log("⚠️ Préchargement intelligent désactivé pour éviter les chargements multiples");
    return () => {};
  }, [currentSong, isPlaying, queue]);

  // Préchargement queue DÉSACTIVÉ
  useEffect(() => {
    console.log("⚠️ Préchargement de queue désactivé");
    return () => {};
  }, [queue]);

  return {
    getCacheStats: () => ({ size: 0, maxSize: 0, entries: [] })
  };
};