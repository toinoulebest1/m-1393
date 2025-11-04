import { useEffect, useRef } from 'react';
import { Song } from '@/types/player';
import { useIntelligentPreloader } from './useIntelligentPreloader';
import { predictiveUrlGenerator } from '@/utils/predictiveUrlGenerator';

interface UseUltraFastPlayerProps {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  currentIndex: number;
}

export const useUltraFastPlayer = ({
  currentSong,
  queue,
  isPlaying,
  currentIndex
}: UseUltraFastPlayerProps) => {
  const { recordTransition } = useIntelligentPreloader();
  const previousSongRef = useRef<Song | null>(null);

  // Enregistrer les transitions entre chansons
  useEffect(() => {
    if (currentSong && previousSongRef.current && currentSong.id !== previousSongRef.current.id) {
      console.log("🔄 Transition détectée:", previousSongRef.current.title, "→", currentSong.title);
      recordTransition(previousSongRef.current, currentSong);
    }
    previousSongRef.current = currentSong;
  }, [currentSong, recordTransition]);

  // Génération prédictive d'URLs pour les prochaines chansons
  useEffect(() => {
    if (!isPlaying || !currentSong || queue.length === 0) return;

    console.log("🔮 Démarrage génération prédictive URLs");
    
    // Délai de 500ms pour ne pas surcharger au démarrage
    const timeoutId = window.setTimeout(() => {
      predictiveUrlGenerator.pregenerateUrls(queue, currentIndex).catch(err => {
        console.warn("⚠️ Erreur génération prédictive:", err);
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentSong, isPlaying, queue, currentIndex]);

  return {
    getCacheStats: () => predictiveUrlGenerator.getStats()
  };
};