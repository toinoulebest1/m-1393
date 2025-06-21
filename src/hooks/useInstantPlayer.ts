
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
  
  // Préchargement intelligent optimisé
  const intelligentPrefetch = useCallback(async () => {
    if (!currentSong || queue.length === 0) return;
    
    console.log("🧠 Préchargement intelligent optimisé");
    
    try {
      // Trouver l'index de la chanson actuelle
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
      
      if (currentIndex !== -1) {
        const prefetchUrls: string[] = [];
        
        // Priorité 1: Les 2 chansons suivantes (les plus importantes)
        for (let i = 1; i <= 2 && currentIndex + i < queue.length; i++) {
          prefetchUrls.push(queue[currentIndex + i].url);
        }
        
        // Priorité 2: La chanson précédente si applicable
        if (currentIndex > 0) {
          prefetchUrls.push(queue[currentIndex - 1].url);
        }
        
        // Priorité 3: La 3ème chanson suivante
        if (currentIndex + 3 < queue.length) {
          prefetchUrls.push(queue[currentIndex + 3].url);
        }
        
        // Priorité 4: 3 chansons aléatoires de la queue (priorité basse)
        const remainingSongs = queue
          .filter((_, idx) => Math.abs(idx - currentIndex) > 3)
          .slice(0, 3);
        
        prefetchUrls.push(...remainingSongs.map(s => s.url));
        
        // Précharger avec le nouveau système optimisé
        await InstantStreaming.prefetchNext(prefetchUrls);
      }
    } catch (error) {
      console.warn("⚠️ Erreur préchargement intelligent:", error);
    }
  }, [currentSong, queue]);

  // Préchargement immédiat au début de la lecture (plus agressif)
  useEffect(() => {
    if (currentSong && isPlaying) {
      // Délai encore plus court pour ne pas bloquer la lecture
      const timeout = setTimeout(() => {
        intelligentPrefetch();
      }, 10); // 10ms seulement
      
      return () => clearTimeout(timeout);
    }
  }, [currentSong, isPlaying, intelligentPrefetch]);

  // Préchargement de la queue au changement (plus conservateur)
  useEffect(() => {
    if (queue.length > 0) {
      // Préchargement différé moins agressif pour éviter la surcharge
      const timeout = setTimeout(() => {
        // Précharger seulement les 5 premières chansons de la queue
        const visibleQueue = queue.slice(0, 5);
        InstantStreaming.prefetchNext(visibleQueue.map(s => s.url));
      }, 800); // 800ms après le changement de queue
      
      return () => clearTimeout(timeout);
    }
  }, [queue]);

  // Nettoyage du cache des fichiers inexistants quand la queue change
  useEffect(() => {
    // Nettoyer le cache des inexistants de temps en temps
    const cleanup = setTimeout(() => {
      InstantStreaming.clearNotFoundCache();
    }, 30000); // Toutes les 30 secondes
    
    return () => clearTimeout(cleanup);
  }, []);

  return {
    getInstantAudioUrl: InstantStreaming.getInstantAudioUrl,
    getStreamingStats: InstantStreaming.getStats,
    clearNotFoundCache: InstantStreaming.clearNotFoundCache
  };
};
