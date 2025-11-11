import { useCallback, useEffect, useRef } from 'react';
import { Song } from '@/types/player';
// import { memoryCache } from '@/utils/memoryCache'; // DÉSACTIVÉ
import { getAudioFileUrl } from '@/utils/storage';
import { addToCache, isInCache } from '@/utils/audioCache';
import { getDeezerRecommendationsByGenre } from '@/services/deezerRecommendations';

interface ListeningPattern {
  songId: string;
  nextSongIds: string[];
  frequency: number;
  lastUpdated: number;
}

export const useIntelligentPreloader = () => {
  const patternsRef = useRef<Map<string, ListeningPattern>>(new Map());
  const preloadingRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

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

  // Prédire les prochaines chansons probables - FONCTIONNALITÉ DÉSACTIVÉE
  const predictNextSongs = useCallback(async (currentSong: Song, recentHistory: Song[]): Promise<Song[]> => {
    if (!currentSong) return [];
    
    console.log("🔮 Prédiction intelligente désactivée (API Deezer supprimée).");
    return [];
  }, []);

  // Annuler tous les préchargements en cours
  const cancelAllPreloads = useCallback(() => {
    const count = abortControllersRef.current.size;
    if (count > 0) {
      console.log(`⏹️ Annulation de ${count} préchargement(s) en cours`);
      abortControllersRef.current.forEach(controller => controller.abort());
      abortControllersRef.current.clear();
      preloadingRef.current.clear();
    }
  }, []);

  // Préchargement INTELLIGENT avec annulation
  const preloadPredictedSongs = useCallback(async (predictions: Song[]) => {
    if (predictions.length === 0) return;
    
    // Annuler les préchargements précédents
    cancelAllPreloads();
    
    console.log("🚀 PRÉCHARGEMENT:", predictions.length, "chanson(s)");
    
    const preloadPromises = predictions.map(async (song, index) => {
      if (preloadingRef.current.has(song.id)) {
        console.log("⏭️ Déjà en cours:", song.title);
        return;
      }
      preloadingRef.current.add(song.id);
      
      const controller = new AbortController();
      abortControllersRef.current.set(song.id, controller);
      
      try {
        const startTime = performance.now();
        
        // Vérifier cache IndexedDB
        const inCache = await isInCache(song.url);
        if (inCache) {
          console.log("✅ Déjà en cache:", song.title);
          preloadingRef.current.delete(song.id);
          abortControllersRef.current.delete(song.id);
          return;
        }
        
        console.log(`📥 Préchargement [${index + 1}/${predictions.length}]:`, song.title);
        
        // Récupérer l'URL audio avec timeout court (3s max)
        const urlPromise = getAudioFileUrl(song.url, song.title, song.artist, song.id);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('URL timeout')), 3000)
        );
        
        const audioUrl = await Promise.race([urlPromise, timeoutPromise]);
        
        if (!audioUrl || typeof audioUrl !== 'string') {
          throw new Error("URL audio invalide");
        }
        
        // Test rapide de l'URL (HEAD request) avant téléchargement complet
        const headResponse = await fetch(audioUrl, { 
          method: 'HEAD',
          signal: controller.signal
        });
        
        if (!headResponse.ok) {
          console.log(`⚠️ URL non disponible (${headResponse.status}):`, song.title);
          return; // Échec silencieux
        }
        
        // Si HEAD OK, télécharger le fichier complet
        const response = await fetch(audioUrl, { 
          signal: controller.signal,
          cache: 'default'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
        
        // Mettre en cache
        await addToCache(song.url, blob);
        
        const elapsed = (performance.now() - startTime).toFixed(0);
        console.log(`✅ Préchargé [${elapsed}ms]:`, song.title, `(${sizeMB} MB)`);
        
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log("⏹️ Préchargement annulé:", song.title);
        } else {
          // Échec SILENCIEUX - ne pas impacter la lecture
          console.log("⚠️ Préchargement ignoré (service indisponible):", song.title);
        }
      } finally {
        preloadingRef.current.delete(song.id);
        abortControllersRef.current.delete(song.id);
      }
    });
    
    await Promise.allSettled(preloadPromises);
    console.log("✅ Préchargements terminés");
  }, [cancelAllPreloads]);

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
    cancelAllPreloads,
    getPatternStats: () => ({
      totalPatterns: patternsRef.current.size,
      patterns: Array.from(patternsRef.current.values())
    })
  };
};