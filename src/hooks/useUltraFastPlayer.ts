
import { useEffect, useRef } from 'react';
import { Song } from '@/types/player';
import { useIntelligentPreloader } from './useIntelligentPreloader';
import { memoryCache } from '@/utils/memoryCache';

interface UseUltraFastPlayerProps {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
}

// Cache ultra-conservateur pour les fichiers inexistants
const nonExistentFiles = new Set<string>();
const verificationAttempts = new Map<string, number>();
const MAX_ATTEMPTS = 1; // Une seule tentative maximum

export const useUltraFastPlayer = ({
  currentSong,
  queue,
  isPlaying
}: UseUltraFastPlayerProps) => {
  const { recordTransition, predictNextSongs } = useIntelligentPreloader();
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

  // Fonction ultra-conservatrice pour vérifier si on doit précharger
  const shouldAttemptPreload = (songUrl: string): boolean => {
    // Si déjà marqué comme inexistant, ne pas réessayer
    if (nonExistentFiles.has(songUrl)) {
      return false;
    }
    
    // Vérifier le nombre de tentatives
    const attempts = verificationAttempts.get(songUrl) || 0;
    if (attempts >= MAX_ATTEMPTS) {
      nonExistentFiles.add(songUrl);
      return false;
    }
    
    return true;
  };

  // Marquer une tentative
  const markAttempt = (songUrl: string, success: boolean) => {
    if (success) {
      // Réinitialiser les compteurs en cas de succès
      verificationAttempts.delete(songUrl);
      nonExistentFiles.delete(songUrl);
    } else {
      // Incrémenter les tentatives en cas d'échec
      const attempts = verificationAttempts.get(songUrl) || 0;
      verificationAttempts.set(songUrl, attempts + 1);
      
      if (attempts + 1 >= MAX_ATTEMPTS) {
        nonExistentFiles.add(songUrl);
        console.log("🚫 Fichier marqué comme inexistant définitivement:", songUrl);
      }
    }
  };

  // Préchargement ultra-minimal (seulement si en cours de lecture)
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    // Annuler le préchargement précédent
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Préchargement très conservateur après un long délai
    preloadTimeoutRef.current = window.setTimeout(async () => {
      console.log("🎯 Préchargement ultra-minimal conservateur");
      
      // Seulement 1 chanson suivante dans la queue
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
      if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
        const nextSong = queue[currentIndex + 1];
        
        // Vérifier si on peut précharger
        if (shouldAttemptPreload(nextSong.url)) {
          // Vérifier d'abord si déjà en cache
          if (memoryCache.has(nextSong.url)) {
            console.log("⚡ Déjà en cache:", nextSong.title);
            return;
          }
          
          try {
            console.log("🎵 Tentative préchargement silencieux:", nextSong.title);
            await memoryCache.preloadBatch([nextSong.url]);
            markAttempt(nextSong.url, true);
            console.log("✅ Préchargement réussi:", nextSong.title);
          } catch (error) {
            // Erreur silencieuse
            markAttempt(nextSong.url, false);
            // Ne pas loguer l'erreur pour éviter le spam console
          }
        }
      }
    }, 2000); // Délai de 2 secondes

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [currentSong, isPlaying, queue]);

  // Nettoyage périodique des caches (très conservateur)
  useEffect(() => {
    const cleanup = setInterval(() => {
      // Nettoyer seulement si les caches deviennent énormes
      if (nonExistentFiles.size > 100) {
        console.log("🧹 Nettoyage cache ultra-conservateur");
        const oldSize = nonExistentFiles.size;
        nonExistentFiles.clear();
        verificationAttempts.clear();
        console.log(`🧹 ${oldSize} entrées nettoyées`);
      }
    }, 15 * 60 * 1000); // Toutes les 15 minutes

    return () => clearInterval(cleanup);
  }, []);

  return {
    getCacheStats: () => ({
      ...memoryCache.getStats(),
      nonExistentFiles: nonExistentFiles.size,
      verificationAttempts: verificationAttempts.size
    })
  };
};
