
import { useCallback, useEffect } from 'react';
import { Song } from '@/types/player';
import { InstantStreaming } from '@/utils/instantStreaming';

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
  
  // Préchargement intelligent au changement de chanson
  const intelligentPrefetch = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;
    
    console.log("🧠 Préchargement intelligent");
    
    try {
      // Trouver l'index de la chanson actuelle
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
      
      if (currentIndex !== -1) {
        const prefetchUrls: string[] = [];
        
        // Ajouter les 3 chansons suivantes (priorité haute)
        for (let i = 1; i <= 3 && currentIndex + i < queue.length; i++) {
          prefetchUrls.push(queue[currentIndex + i].url);
        }
        
        // Ajouter la chanson précédente si applicable
        if (currentIndex > 0) {
          prefetchUrls.push(queue[currentIndex - 1].url);
        }
        
        // Ajouter 5 chansons aléatoires de la queue (priorité basse)
        const remainingSongs = queue
          .filter((_, idx) => Math.abs(idx - currentIndex) > 3)
          .slice(0, 5);
        
        prefetchUrls.push(...remainingSongs.map(s => s.url));
        
        // Précharger en parallèle
        await InstantStreaming.prefetchNext(prefetchUrls);
      }
    } catch (error) {
      console.warn("⚠️ Erreur préchargement intelligent:", error);
    }
  }, [currentSong, queue]);

  // Préchargement immédiat au début de la lecture
  useEffect(() => {
    if (currentSong && isPlaying) {
      // Délai ultra-court pour ne pas bloquer la lecture
      const timeout = setTimeout(() => {
        intelligentPrefetch();
      }, 50); // 50ms seulement
      
      return () => clearTimeout(timeout);
    }
  }, [currentSong, isPlaying, intelligentPrefetch]);

  // Préchargement de la queue au changement
  useEffect(() => {
    if (queue.length > 0) {
      // Préchargement différé plus agressif
      const timeout = setTimeout(() => {
        // Précharger les 8 premières chansons de la queue
        const visibleQueue = queue.slice(0, 8);
        InstantStreaming.prefetchNext(visibleQueue.map(s => s.url));
      }, 500); // 500ms après le changement de queue
      
      return () => clearTimeout(timeout);
    }
  }, [queue]);

  return {
    getInstantAudioUrl: InstantStreaming.getInstantAudioUrl,
    getStreamingStats: InstantStreaming.getStats
  };
};
