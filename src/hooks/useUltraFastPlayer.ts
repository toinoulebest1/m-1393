
import { useEffect, useRef } from 'react';
import { Song } from '@/types/player';
import { useIntelligentPreloader } from './useIntelligentPreloader';
import { memoryCache } from '@/utils/memoryCache';
import { checkFileExistsOnDropbox, isDropboxEnabled } from '@/utils/dropboxStorage';
import { supabase } from '@/integrations/supabase/client';

interface UseUltraFastPlayerProps {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
}

// Cache persistant pour les fichiers non existants (plus agressif)
const nonExistentFiles = new Set<string>();
const permanentlyMissingFiles = new Set<string>();

// Fonction pour vérifier si un fichier existe avec cache intelligent
const checkFileExists = async (songUrl: string): Promise<boolean> => {
  // Vérifier d'abord le cache permanent des fichiers manquants
  if (permanentlyMissingFiles.has(songUrl)) {
    console.log("🚫 Fichier définitivement manquant (cache permanent):", songUrl);
    return false;
  }

  // Vérifier le cache temporaire
  if (nonExistentFiles.has(songUrl)) {
    console.log("🚫 Fichier marqué comme inexistant (cache):", songUrl);
    return false;
  }

  try {
    if (isDropboxEnabled()) {
      const exists = await checkFileExistsOnDropbox(songUrl);
      if (!exists) {
        nonExistentFiles.add(songUrl);
        // Après 2 échecs, marquer comme définitivement manquant
        if (nonExistentFiles.has(songUrl)) {
          permanentlyMissingFiles.add(songUrl);
          console.log("🔒 Fichier marqué comme définitivement manquant:", songUrl);
        }
        return false;
      }
      return true;
    } else {
      // Vérifier dans Supabase (plus rapide)
      const { data, error } = await supabase.storage
        .from('audio')
        .list('', {
          search: songUrl,
          limit: 1
        });

      if (error || !data || data.length === 0) {
        nonExistentFiles.add(songUrl);
        permanentlyMissingFiles.add(songUrl); // Marquer directement comme manquant
        console.log("🔒 Fichier Supabase marqué comme manquant:", songUrl);
        return false;
      }
      return true;
    }
  } catch (error) {
    console.warn("⚠️ Erreur vérification existence fichier:", songUrl, error);
    nonExistentFiles.add(songUrl);
    permanentlyMissingFiles.add(songUrl);
    return false;
  }
};

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

  // Préchargement intelligent ultra-optimisé
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    // Annuler le préchargement précédent
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Démarrer le préchargement après un délai minimal
    preloadTimeoutRef.current = window.setTimeout(async () => {
      console.log("🚀 Préchargement ultra-intelligent optimisé");
      
      try {
        // 1. Prédictions intelligentes (limiter à 2 max)
        const predictions = predictNextSongs(currentSong, queue);
        if (predictions.length > 0) {
          const validPredictions: Song[] = [];
          // Traiter seulement les 2 premières prédictions
          for (const song of predictions.slice(0, 2)) {
            // Vérification ultra-rapide avec cache
            if (!permanentlyMissingFiles.has(song.url) && !nonExistentFiles.has(song.url)) {
              const exists = await checkFileExists(song.url);
              if (exists) {
                validPredictions.push(song);
              }
            }
          }
          
          if (validPredictions.length > 0) {
            console.log("🎯 Préchargement prédictions validées:", validPredictions.length);
            await preloadPredictedSongs(validPredictions);
          }
        }
        
        // 2. Précharger seulement la chanson suivante dans la queue
        const currentIndex = queue.findIndex(s => s.id === currentSong.id);
        if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
          const nextSong = queue[currentIndex + 1];
          
          // Vérification ultra-rapide
          if (!permanentlyMissingFiles.has(nextSong.url) && !nonExistentFiles.has(nextSong.url)) {
            const exists = await checkFileExists(nextSong.url);
            if (exists) {
              console.log("🎵 Préchargement chanson suivante:", nextSong.title);
              await memoryCache.preloadBatch([nextSong.url]);
            }
          }
        }
      } catch (error) {
        console.warn("⚠️ Erreur préchargement ultra-intelligent:", error);
      }
    }, 800); // Délai plus long pour éviter la surcharge

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [currentSong, isPlaying, queue, predictNextSongs, preloadPredictedSongs]);

  // Préchargement initial minimal de la queue
  useEffect(() => {
    if (queue.length === 0) return;

    const timeout = setTimeout(async () => {
      console.log("🎯 Préchargement queue initial ultra-minimal");
      
      try {
        // Seulement les 2 premières chansons
        const firstSongs = queue.slice(0, 2);
        const validSongs: Song[] = [];
        
        for (const song of firstSongs) {
          // Vérification ultra-rapide avec cache
          if (!permanentlyMissingFiles.has(song.url) && !nonExistentFiles.has(song.url)) {
            const exists = await checkFileExists(song.url);
            if (exists) {
              validSongs.push(song);
            }
          }
        }
        
        if (validSongs.length > 0) {
          console.log("✅ Préchargement queue initial:", validSongs.length, "chansons validées");
          await memoryCache.preloadBatch(validSongs.map(s => s.url));
        } else {
          console.log("ℹ️ Aucune chanson valide trouvée pour le préchargement initial");
        }
      } catch (error) {
        console.warn("⚠️ Erreur préchargement queue initial:", error);
      }
    }, 3000); // Délai encore plus long pour l'initialisation

    return () => clearTimeout(timeout);
  }, [queue]);

  // Nettoyage périodique des caches
  useEffect(() => {
    const cleanup = setInterval(() => {
      // Nettoyer le cache temporaire s'il devient trop gros
      if (nonExistentFiles.size > 50) {
        console.log("🧹 Nettoyage cache fichiers inexistants");
        nonExistentFiles.clear();
      }
      
      // Nettoyer le cache permanent s'il devient énorme
      if (permanentlyMissingFiles.size > 200) {
        console.log("🧹 Nettoyage cache fichiers définitivement manquants");
        permanentlyMissingFiles.clear();
      }
    }, 10 * 60 * 1000); // Toutes les 10 minutes

    return () => clearInterval(cleanup);
  }, []);

  return {
    getCacheStats: () => ({
      ...memoryCache.getStats(),
      nonExistentFiles: nonExistentFiles.size,
      permanentlyMissingFiles: permanentlyMissingFiles.size
    })
  };
};
