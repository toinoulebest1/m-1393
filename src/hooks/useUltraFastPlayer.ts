
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

// Cache pour les fichiers non existants
const nonExistentFiles = new Set<string>();

// Fonction pour vérifier si un fichier existe
const checkFileExists = async (songUrl: string): Promise<boolean> => {
  // Vérifier d'abord le cache des fichiers inexistants
  if (nonExistentFiles.has(songUrl)) {
    console.log("⚠️ Fichier marqué comme inexistant:", songUrl);
    return false;
  }

  try {
    if (isDropboxEnabled()) {
      const exists = await checkFileExistsOnDropbox(songUrl);
      if (!exists) {
        nonExistentFiles.add(songUrl);
        console.log("❌ Fichier non trouvé sur Dropbox, ajouté au cache:", songUrl);
      }
      return exists;
    } else {
      // Vérifier dans Supabase
      const { data, error } = await supabase.storage
        .from('audio')
        .list('', {
          search: songUrl,
          limit: 1
        });

      if (error || !data || data.length === 0) {
        nonExistentFiles.add(songUrl);
        console.log("❌ Fichier non trouvé sur Supabase, ajouté au cache:", songUrl);
        return false;
      }
      return true;
    }
  } catch (error) {
    console.warn("⚠️ Erreur vérification existence fichier:", songUrl, error);
    nonExistentFiles.add(songUrl);
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

  // Préchargement intelligent avec vérification d'existence
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    // Annuler le préchargement précédent
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Démarrer le préchargement après un délai
    preloadTimeoutRef.current = window.setTimeout(async () => {
      console.log("🚀 Démarrage préchargement intelligent avec vérification");
      
      try {
        // 1. Prédictions intelligentes
        const predictions = predictNextSongs(currentSong, queue);
        if (predictions.length > 0) {
          // Filtrer les prédictions qui existent
          const validPredictions: Song[] = [];
          for (const song of predictions.slice(0, 3)) { // Limiter à 3 prédictions
            const exists = await checkFileExists(song.url);
            if (exists) {
              validPredictions.push(song);
            }
          }
          
          if (validPredictions.length > 0) {
            console.log("🎯 Préchargement prédictions validées:", validPredictions.length);
            await preloadPredictedSongs(validPredictions);
          }
        }
        
        // 2. Précharger les 2 chansons suivantes dans la queue
        const currentIndex = queue.findIndex(s => s.id === currentSong.id);
        if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
          const nextSongs = queue.slice(currentIndex + 1, currentIndex + 3); // Seulement 2 chansons
          
          const validNextSongs: Song[] = [];
          for (const song of nextSongs) {
            const exists = await checkFileExists(song.url);
            if (exists) {
              validNextSongs.push(song);
            }
          }
          
          if (validNextSongs.length > 0) {
            console.log("🎵 Préchargement queue validée:", validNextSongs.length, "chansons");
            await memoryCache.preloadBatch(validNextSongs.map(s => s.url));
          }
        }
      } catch (error) {
        console.warn("⚠️ Erreur préchargement intelligent:", error);
      }
    }, 1000); // Délai de 1 seconde pour éviter les conflits

    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [currentSong, isPlaying, queue, predictNextSongs, preloadPredictedSongs]);

  // Préchargement initial de la queue avec vérification
  useEffect(() => {
    if (queue.length === 0) return;

    const timeout = setTimeout(async () => {
      console.log("🎯 Préchargement queue initiale avec vérification");
      
      try {
        const firstSongs = queue.slice(0, 3); // Réduire à 3 chansons seulement
        const validSongs: Song[] = [];
        
        for (const song of firstSongs) {
          const exists = await checkFileExists(song.url);
          if (exists) {
            validSongs.push(song);
          }
        }
        
        if (validSongs.length > 0) {
          console.log("✅ Préchargement queue initiale:", validSongs.length, "chansons validées");
          await memoryCache.preloadBatch(validSongs.map(s => s.url));
        } else {
          console.log("⚠️ Aucune chanson valide trouvée pour le préchargement initial");
        }
      } catch (error) {
        console.warn("⚠️ Erreur préchargement queue initiale:", error);
      }
    }, 2000); // Délai plus long pour l'initialisation

    return () => clearTimeout(timeout);
  }, [queue]);

  // Nettoyer le cache des fichiers inexistants périodiquement
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (nonExistentFiles.size > 100) { // Si le cache devient trop gros
        console.log("🧹 Nettoyage cache fichiers inexistants");
        nonExistentFiles.clear();
      }
    }, 5 * 60 * 1000); // Toutes les 5 minutes

    return () => clearInterval(cleanup);
  }, []);

  return {
    getCacheStats: () => ({
      ...memoryCache.getStats(),
      nonExistentFiles: nonExistentFiles.size
    })
  };
};
