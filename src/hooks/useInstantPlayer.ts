
import { useEffect, useRef } from 'react';
import { Song } from '@/types/player';
import { UltraFastStreaming } from '@/utils/instantStreaming';
import { memoryCache } from '@/utils/memoryCache';

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
  const preloadTimeoutRef = useRef<number | null>(null);
  const lastQueueRef = useRef<Song[]>([]);

  // Préchargement intelligent quand une chanson commence
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    // Annuler le préchargement précédent
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Démarrer le préchargement après un délai ultra-court
    preloadTimeoutRef.current = window.setTimeout(async () => {
      console.log("🚀 Préchargement prioritaire des chansons suivantes");
      
      // Précharger SEULEMENT les 2 chansons suivantes dans la queue
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
      if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
        const nextTwoSongs = queue.slice(currentIndex + 1, currentIndex + 3);
        const availableSongs = nextTwoSongs.filter(song => 
          UltraFastStreaming.isFileAvailable(song.url)
        );
        
        if (availableSongs.length > 0) {
          console.log("🎵 Préchargement prioritaire:", availableSongs.map(s => s.title));
          await UltraFastStreaming.preloadBatch(availableSongs.map(s => s.url));
        }
      }
    }, 100); // 100ms pour laisser le temps à la chanson de démarrer

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [currentSong, isPlaying, queue]);

  // Préchargement différé quand la queue change (moins agressif)
  useEffect(() => {
    if (queue.length === 0) return;
    
    // Vérifier si la queue a vraiment changé
    const queueChanged = JSON.stringify(lastQueueRef.current.map(s => s.id)) !== 
                        JSON.stringify(queue.map(s => s.id));
    
    if (!queueChanged) return;
    
    lastQueueRef.current = queue;

    // Préchargement différé et moins agressif des 3-5 premières chansons
    const timeout = setTimeout(async () => {
      // Filtrer les chansons disponibles
      const availableSongs = queue.slice(0, 5).filter(song => 
        UltraFastStreaming.isFileAvailable(song.url) && !memoryCache.has(song.url)
      );
      
      if (availableSongs.length > 0) {
        console.log("🎯 Préchargement différé queue:", availableSongs.length, "chansons");
        // Préchargement plus lent pour ne pas surcharger
        await UltraFastStreaming.preloadBatch(availableSongs.map(s => s.url));
      }
    }, 2000); // 2 secondes de délai pour ne pas interférer

    return () => clearTimeout(timeout);
  }, [queue]);

  return {
    getCacheStats: () => UltraFastStreaming.getStats()
  };
};
