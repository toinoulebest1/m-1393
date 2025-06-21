
/**
 * Streaming instantané - Optimisé pour un démarrage ultra-rapide
 */

import { UltraFastCache } from './ultraFastCache';
import { memoryCache } from './memoryCache';
import { getAudioFileUrl } from './storage';

export class InstantStreaming {
  private static parallelFetches = new Map<string, Promise<string>>();
  private static prefetchQueue = new Set<string>();
  
  /**
   * Récupération instantanée avec fetch parallèle optimisé
   */
  static async getInstantAudioUrl(songUrl: string): Promise<string> {
    const startTime = performance.now();
    console.log("⚡ === STREAMING INSTANTANÉ ===");
    
    // 1. Cache L0 ultra-rapide (< 0.1ms)
    const l0Result = UltraFastCache.getL0(songUrl);
    if (l0Result) {
      console.log("⚡ L0:", (performance.now() - startTime).toFixed(1), "ms");
      return l0Result;
    }

    // 2. Cache mémoire (< 1ms)
    const memResult = memoryCache.get(songUrl);
    if (memResult) {
      console.log("💾 Memory:", (performance.now() - startTime).toFixed(1), "ms");
      // Promouvoir vers L0 en arrière-plan
      this.promoteToL0Async(songUrl, memResult);
      return memResult;
    }

    // 3. Fetch parallèle si déjà en cours
    if (this.parallelFetches.has(songUrl)) {
      console.log("🔄 Réutilisation fetch existant");
      return this.parallelFetches.get(songUrl)!;
    }

    // 4. Nouveau fetch ultra-optimisé
    const fetchPromise = this.ultraFastFetch(songUrl, startTime);
    this.parallelFetches.set(songUrl, fetchPromise);

    try {
      const result = await fetchPromise;
      this.parallelFetches.delete(songUrl);
      return result;
    } catch (error) {
      this.parallelFetches.delete(songUrl);
      throw error;
    }
  }

  /**
   * Fetch ultra-optimisé avec timeout court
   */
  private static async ultraFastFetch(songUrl: string, startTime: number): Promise<string> {
    console.log("🚀 Ultra-fast fetch:", songUrl);
    
    try {
      // Timeout agressif de 3 secondes max
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
      
      const fetchPromise = getAudioFileUrl(songUrl);
      
      const audioUrl = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!audioUrl || typeof audioUrl !== 'string') {
        throw new Error('URL invalide');
      }
      
      const elapsed = performance.now() - startTime;
      console.log("✅ Fetch réussi:", elapsed.toFixed(1), "ms");
      
      // Mise en cache immédiate
      memoryCache.set(songUrl, audioUrl);
      
      // Promotion L0 en arrière-plan
      setTimeout(() => this.promoteToL0Async(songUrl, audioUrl), 0);
      
      return audioUrl;
      
    } catch (error) {
      const elapsed = performance.now() - startTime;
      console.error("❌ Fetch échoué:", elapsed.toFixed(1), "ms", error);
      throw new Error(`Impossible de charger: ${songUrl}`);
    }
  }

  /**
   * Promotion L0 asynchrone
   */
  private static async promoteToL0Async(songUrl: string, audioUrl: string): Promise<void> {
    try {
      const response = await fetch(audioUrl, { 
        method: 'HEAD' // Juste pour vérifier l'URL
      });
      
      if (response.ok) {
        // Télécharger le blob complet en arrière-plan
        setTimeout(async () => {
          try {
            const fullResponse = await fetch(audioUrl);
            if (fullResponse.ok) {
              const blob = await fullResponse.blob();
              UltraFastCache.setL0(songUrl, audioUrl, blob);
              console.log("💾 L0 promotion:", songUrl);
            }
          } catch (error) {
            console.warn("⚠️ L0 promotion échouée:", error);
          }
        }, 100);
      }
    } catch (error) {
      console.warn("⚠️ L0 check échoué:", error);
    }
  }

  /**
   * Préchargement agressif des prochaines chansons
   */
  static async prefetchNext(songUrls: string[]): Promise<void> {
    if (songUrls.length === 0) return;
    
    console.log("🎯 Préchargement agressif:", songUrls.length);
    
    // Traiter les URLs par priorité décroissante
    const promises = songUrls.map(async (url, index) => {
      // Éviter les doublons
      if (this.prefetchQueue.has(url)) return;
      this.prefetchQueue.add(url);
      
      try {
        // Délai échelonné: 0ms, 50ms, 100ms, etc.
        const delay = index * 50;
        
        setTimeout(async () => {
          try {
            // Vérifier si déjà en cache
            if (memoryCache.has(url) || UltraFastCache.hasL0(url)) {
              return;
            }
            
            // Précharger
            await this.getInstantAudioUrl(url);
            console.log("✅ Préchargé:", url);
            
          } catch (error) {
            console.warn("⚠️ Préchargement échoué:", url, error);
          } finally {
            this.prefetchQueue.delete(url);
          }
        }, delay);
        
      } catch (error) {
        this.prefetchQueue.delete(url);
        console.warn("⚠️ Setup préchargement échoué:", error);
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Nettoyage des ressources
   */
  static cleanup(): void {
    this.parallelFetches.clear();
    this.prefetchQueue.clear();
    console.log("🧹 InstantStreaming nettoyé");
  }

  /**
   * Statistiques
   */
  static getStats() {
    return {
      activeFetches: this.parallelFetches.size,
      prefetchQueue: this.prefetchQueue.size,
      l0Cache: UltraFastCache.getStats(),
      memoryCache: memoryCache.getStats()
    };
  }
}

// Nettoyage automatique
window.addEventListener('beforeunload', () => {
  InstantStreaming.cleanup();
});
