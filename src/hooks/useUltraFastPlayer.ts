import { useEffect, useRef } from 'react';
import { Song } from '@/types/player';
import { useIntelligentPreloader } from './useIntelligentPreloader';
// import { memoryCache } from '@/utils/memoryCache'; // DÉSACTIVÉ

interface UseUltraFastPlayerProps {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  setQueue: (queue: Song[] | ((prev: Song[]) => Song[])) => void;
  getNextSong: () => Song | null;
}

export const useUltraFastPlayer = ({
  currentSong,
  queue,
  isPlaying,
  setQueue,
  getNextSong
}: UseUltraFastPlayerProps) => {
  const { recordTransition, predictNextSongs, preloadPredictedSongs } = useIntelligentPreloader();
  const previousSongRef = useRef<Song | null>(null);
  const preloadTimeoutRef = useRef<number | null>(null);
  const queuePreloadTimeoutRef = useRef<number | null>(null);

  // Enregistrer les transitions entre chansons
  useEffect(() => {
    if (currentSong && previousSongRef.current && currentSong.id !== previousSongRef.current.id) {
      console.log("🔄 Transition détectée:", previousSongRef.current.title, "→", currentSong.title);
      recordTransition(previousSongRef.current, currentSong);
    }
    previousSongRef.current = currentSong;
  }, [currentSong, recordTransition]);

  // Préchargement intelligent basé sur le genre - DÉSACTIVÉ pour éviter la saturation
  useEffect(() => {
    console.log("⚠️ Préchargement intelligent Deezer désactivé (éviter saturation réseau)");
    return () => {};
  }, [currentSong, isPlaying]);

  // Préchargement RETARDÉ de la chanson suivante (après que la musique soit bien démarrée)
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    // Annuler le timeout précédent
    if (queuePreloadTimeoutRef.current) {
      clearTimeout(queuePreloadTimeoutRef.current);
    }

    // Attendre 5 secondes après le début de la lecture pour précharger
    // Cela laisse le temps au streaming de la chanson actuelle de se stabiliser
    queuePreloadTimeoutRef.current = window.setTimeout(async () => {
      const nextSong = getNextSong();
      if (nextSong) {
        console.log("🚀 Préchargement RETARDÉ de la prochaine chanson:", nextSong.title);
        await preloadPredictedSongs([nextSong]);
      }
    }, 5000); // Attendre 5 secondes au lieu de 100ms

    return () => {
      if (queuePreloadTimeoutRef.current) {
        clearTimeout(queuePreloadTimeoutRef.current);
      }
    };
  }, [currentSong, isPlaying, getNextSong, preloadPredictedSongs]);

  return {
    getCacheStats: () => ({ size: 0, maxSize: 0, entries: [] })
  };
};