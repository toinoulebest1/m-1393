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

  // Prédire les prochaines chansons probables (basé sur Deezer et genre)
  const predictNextSongs = useCallback(async (currentSong: Song, recentHistory: Song[]): Promise<Song[]> => {
    if (!currentSong) return [];
    
    const predictions: Song[] = [];
    
    // Créer un Set d'IDs récents pour exclusion rapide (20 dernières chansons)
    const recentIds = new Set(recentHistory.slice(-20).map(s => s.id));
    
    // Créer un Set des artistes récents (10 derniers artistes)
    const recentArtists = new Set(
      recentHistory.slice(-10).map(s => s.artist.toLowerCase().trim())
    );
    
    try {
      console.log("🎵 Utilisation de l'API Deezer pour recommandations...");
      console.log("🚫 Exclusion de", recentIds.size, "chansons et", recentArtists.size, "artistes récents");
      
      const deezerRecommendations = await getDeezerRecommendationsByGenre(
        currentSong, 
        10, // Demander plus pour compenser les exclusions
        recentHistory
      );
      
      for (const song of deezerRecommendations) {
        // Ne pas ajouter les chansons déjà dans l'historique récent
        // NI les chansons du même artiste récent
        const artistMatch = recentArtists.has(song.artist.toLowerCase().trim());
        if (!recentIds.has(song.id) && !artistMatch && !predictions.some(p => p.id === song.id)) {
          predictions.push(song);
        }
      }
    } catch (error) {
      console.warn("⚠️ Erreur chargement recommandations Deezer:", error);
    }
    
    // Choisir ALÉATOIREMENT 1 chanson parmi les prédictions
    if (predictions.length > 0) {
      const randomIndex = Math.floor(Math.random() * predictions.length);
      const selectedSong = predictions[randomIndex];
      console.log(`🎲 Chanson sélectionnée aléatoirement [${randomIndex + 1}/${predictions.length}]:`, 
                 `${selectedSong.title} - ${selectedSong.artist}`);
      return [selectedSong];
    }
    
    console.log("🔮 Aucune prédiction disponible");
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
        
        // Récupérer l'URL audio
        const audioUrl = await getAudioFileUrl(song.url, song.deezer_id, song.title, song.artist, song.id);
        
        if (!audioUrl || typeof audioUrl !== 'string') {
          throw new Error("URL audio invalide");
        }
        
        // Télécharger avec signal d'annulation
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
          console.warn("⚠️ Échec préchargement:", song.title);
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
