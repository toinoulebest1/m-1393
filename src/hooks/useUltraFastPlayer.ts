
import { useEffect, useRef } from 'react';
import { Song } from '@/types/player';
import { useIntelligentPreloader } from './useIntelligentPreloader';
import { memoryCache } from '@/utils/memoryCache';
import { nonExistentFilesCache } from '@/utils/nonExistentFilesCache';

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
      recordTransition(previousSongRef.current, currentSong);
    }
    previousSongRef.current = currentSong;
  }, [currentSong, recordTransition]);

  // Préchargement ultra-conservateur - seulement la chanson suivante
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    // Annuler le préchargement précédent
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Préchargement minimal après un délai
    preloadTimeoutRef.current = window.setTimeout(async () => {
      try {
        // Seulement la chanson suivante dans la queue
        const currentIndex = queue.findIndex(s => s.id === currentSong.id);
        if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
          const nextSong = queue[currentIndex + 1];
          
          // Vérifier le cache des fichiers inexistants AVANT de tenter quoi que ce soit
          if (!nonExistentFilesCache.isNonExistent(nextSong.url)) {
            // Vérifier si déjà en cache mémoire
            if (!memoryCache.has(nextSong.url)) {
              // Précharger SILENCIEUSEMENT seulement cette chanson
              await memoryCache.preloadBatch([nextSong.url]);
            }
          }
        }
      } catch (error) {
        // Ignorer TOUTES les erreurs silencieusement
      }
    }, 3000); // Délai de 3 secondes

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [currentSong, isPlaying, queue]);

  return {
    getCacheStats: () => ({
      ...memoryCache.getStats(),
      nonExistentFiles: nonExistentFilesCache.getStats()
    })
  };
};
