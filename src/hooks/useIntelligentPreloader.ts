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
    
    console.log("🔮 Prédictions intelligentes (Deezer + genre):", predictions.map(s => `${s.title} - ${s.artist}`));
    return predictions.slice(0, 1); // Maximum 1 prédiction
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
            // Cache mémoire DÉSACTIVÉ
            // if (memoryCache.has(song.url)) {
            //   console.log("⚡ Déjà en cache mémoire:", song.title);
            //   return;
            // }
            
            // Vérifier cache IndexedDB
            if (await isInCache(song.url)) {
              console.log("💾 Déjà en cache IndexedDB:", song.title);
              return;
            }
            
            // Télécharger et mettre en cache
            console.log("📡 Préchargement:", song.title);
            const audioUrl = await getAudioFileUrl(song.url, song.deezer_id, song.title, song.artist, song.id);
            
            if (audioUrl && typeof audioUrl === 'string') {
              // Télécharger immédiatement le fichier complet et le mettre en cache
              console.log("⬇️ Téléchargement fichier audio pour cache:", song.title);
              const response = await fetch(audioUrl);
              if (response.ok) {
                const blob = await response.blob();
                await addToCache(song.url, blob);
                console.log("✅ Chanson actuelle mise en cache avec succès:", song.title);
              } else {
                console.warn("⚠️ Échec téléchargement (HTTP", response.status, "):", song.title);
              }
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
