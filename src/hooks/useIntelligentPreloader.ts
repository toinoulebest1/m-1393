
import { useCallback, useEffect, useRef } from 'react';
import { Song } from '@/types/player';
import { memoryCache } from '@/utils/memoryCache';
import { getAudioFile } from '@/utils/storage';
import { addToCache, isInCache } from '@/utils/audioCache';

interface ListeningPattern {
  songId: string;
  nextSongIds: string[];
  frequency: number;
  lastUpdated: number;
}

export const useIntelligentPreloader = () => {
  const patternsRef = useRef<Map<string, ListeningPattern>>(new Map());
  const preloadingRef = useRef<Set<string>>(new Set());

  // Charger les patterns depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem('listeningPatterns');
    if (saved) {
      try {
        const patterns = JSON.parse(saved);
        patternsRef.current = new Map(patterns);
        console.log("📊 Patterns chargés:", patternsRef.current.size);
      } catch (error) {
        console.warn("⚠️ Erreur chargement patterns:", error);
      }
    }
  }, []);

  // Sauvegarder les patterns
  const savePatterns = useCallback(() => {
    const patterns = Array.from(patternsRef.current.entries());
    localStorage.setItem('listeningPatterns', JSON.stringify(patterns));
  }, []);

  // Enregistrer une transition entre chansons
  const recordTransition = useCallback((fromSong: Song, toSong: Song) => {
    if (!fromSong || !toSong) return;
    
    console.log("📝 Enregistrement transition:", fromSong.title, "→", toSong.title);
    
    const pattern = patternsRef.current.get(fromSong.id) || {
      songId: fromSong.id,
      nextSongIds: [],
      frequency: 0,
      lastUpdated: Date.now()
    };
    
    // Ajouter la chanson suivante ou incrémenter sa fréquence
    const existingIndex = pattern.nextSongIds.indexOf(toSong.id);
    if (existingIndex === -1) {
      pattern.nextSongIds.push(toSong.id);
    }
    
    pattern.frequency++;
    pattern.lastUpdated = Date.now();
    
    patternsRef.current.set(fromSong.id, pattern);
    
    // Sauvegarder de façon différée pour éviter les blocages
    setTimeout(savePatterns, 100);
  }, [savePatterns]);

  // Prédire les prochaines chansons probables
  const predictNextSongs = useCallback((currentSong: Song, queue: Song[]): Song[] => {
    if (!currentSong) return [];
    
    const pattern = patternsRef.current.get(currentSong.id);
    const predictions: Song[] = [];
    
    // Prédictions basées sur l'historique
    if (pattern && pattern.nextSongIds.length > 0) {
      for (const nextId of pattern.nextSongIds.slice(0, 3)) {
        const song = queue.find(s => s.id === nextId);
        if (song) predictions.push(song);
      }
    }
    
    // Prédictions basées sur la file d'attente
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    if (currentIndex !== -1 && currentIndex + 1 < queue.length) {
      const nextInQueue = queue.slice(currentIndex + 1, currentIndex + 4);
      for (const song of nextInQueue) {
        if (!predictions.some(p => p.id === song.id)) {
          predictions.push(song);
        }
      }
    }
    
    console.log("🔮 Prédictions:", predictions.map(s => s.title));
    return predictions.slice(0, 5); // Maximum 5 prédictions
  }, []);

  // Préchargement ultra-agressif
  const preloadPredictedSongs = useCallback(async (predictions: Song[]) => {
    if (predictions.length === 0) return;
    
    console.log("🚀 Préchargement intelligent:", predictions.length, "chansons");
    
    const preloadPromises = predictions.map(async (song, index) => {
      if (preloadingRef.current.has(song.id)) return;
      preloadingRef.current.add(song.id);
      
      try {
        // Priorité décroissante : délai plus court pour les premières chansons
        const delay = index * 25; // 0ms, 25ms, 50ms, 75ms, 100ms
        
        setTimeout(async () => {
          try {
            // Vérifier cache mémoire d'abord
            if (memoryCache.has(song.url)) {
              console.log("⚡ Déjà en cache mémoire:", song.title);
              return;
            }
            
            // Vérifier cache IndexedDB
            if (await isInCache(song.url)) {
              console.log("💾 Déjà en cache IndexedDB:", song.title);
              return;
            }
            
            // Télécharger et mettre en cache
            console.log("📡 Préchargement:", song.title);
            const audioUrl = await getAudioFile(song.url);
            
            if (audioUrl && typeof audioUrl === 'string') {
              // Ajouter au cache mémoire
              memoryCache.set(song.url, audioUrl);
              
              // Télécharger le blob pour IndexedDB en arrière-plan
              setTimeout(async () => {
                try {
                  const response = await fetch(audioUrl);
                  if (response.ok) {
                    const blob = await response.blob();
                    await addToCache(song.url, blob);
                    console.log("✅ Cache IndexedDB:", song.title);
                  }
                } catch (error) {
                  console.warn("⚠️ Erreur cache IndexedDB:", error);
                }
              }, 50);
            }
          } catch (error) {
            console.warn("⚠️ Erreur préchargement:", song.title, error);
          } finally {
            preloadingRef.current.delete(song.id);
          }
        }, delay);
      } catch (error) {
        console.warn("⚠️ Erreur préchargement setup:", song.title, error);
        preloadingRef.current.delete(song.id);
      }
    });
    
    await Promise.allSettled(preloadPromises);
  }, []);

  // Nettoyage des patterns anciens (garder seulement les 30 derniers jours)
  const cleanupOldPatterns = useCallback(() => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [songId, pattern] of patternsRef.current.entries()) {
      if (pattern.lastUpdated < thirtyDaysAgo) {
        patternsRef.current.delete(songId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log("🧹 Nettoyage patterns:", cleaned, "patterns supprimés");
      savePatterns();
    }
  }, [savePatterns]);

  // Nettoyage automatique au démarrage
  useEffect(() => {
    cleanupOldPatterns();
  }, [cleanupOldPatterns]);

  return {
    recordTransition,
    predictNextSongs,
    preloadPredictedSongs,
    getPatternStats: () => ({
      totalPatterns: patternsRef.current.size,
      patterns: Array.from(patternsRef.current.values())
    })
  };
};
