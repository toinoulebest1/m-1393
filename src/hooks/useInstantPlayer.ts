
import { useCallback, useEffect } from 'react';
import { Song } from '@/types/player';
import { InstantStreaming } from '@/utils/instantStreaming';
import { nonExistentFilesCache } from '@/utils/nonExistentFilesCache';

interface UseInstantPlayerProps {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
}

export const useInstantPlayer = ({ 
  currentSong, 
  queue, 
  isPlaying 
}: UseInstantPlayerProps) => {
  
  // Préchargement ultra-conservateur
  const intelligentPrefetch = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;
    
    try {
      // Trouver l'index de la chanson actuelle
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
      
      if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
        // Seulement la chanson suivante
        const nextSong = queue[currentIndex + 1];
        
        // Vérifier le cache des fichiers inexistants
        if (!nonExistentFilesCache.isNonExistent(nextSong.url)) {
          await InstantStreaming.prefetchNext([nextSong.url]);
        }
      }
    } catch (error) {
      // Ignorer silencieusement
    }
  }, [currentSong, queue]);

  // Préchargement immédiat au début de la lecture
  useEffect(() => {
    if (currentSong && isPlaying) {
      // Délai de 2 secondes pour ne pas interférer avec la lecture
      const timeout = setTimeout(() => {
        intelligentPrefetch();
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [currentSong, isPlaying, intelligentPrefetch]);

  return {
    getInstantAudioUrl: InstantStreaming.getInstantAudioUrl,
    getStreamingStats: InstantStreaming.getStats
  };
};
