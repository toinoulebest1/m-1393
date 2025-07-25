/**
 * Système de streaming audio ultra-rapide
 * Optimisé pour des temps de chargement sub-milliseconde
 */

import { getAudioFileUrl } from './storage';
import { UltraFastCache } from './ultraFastCache';
// import { memoryCache } from './memoryCache'; // DÉSACTIVÉ
import { isInCache, getFromCache } from './audioCache';

export class UltraFastStreaming {
  private static promisePool = new Map<string, Promise<string>>();
  private static requestCount = 0;

  /**
   * Obtention URL ultra-rapide avec multiples stratégies parallèles
   */
  static async getAudioUrlUltraFast(songUrl: string): Promise<string> {
    const startTime = performance.now();
    this.requestCount++;
    
    console.log("🚀 Ultra-fast streaming:", songUrl);

    // 1. L0 Cache instantané (< 0.1ms)
    if (UltraFastCache.hasL0(songUrl)) {
      const l0Result = UltraFastCache.getL0(songUrl);
      if (l0Result) {
        const elapsed = performance.now() - startTime;
        console.log("⚡ L0 CACHE:", elapsed.toFixed(2), "ms");
        return l0Result;
      }
    }

    // 2. Warm cache (< 0.5ms)
    const warmResult = UltraFastCache.getWarm(songUrl);
    if (warmResult) {
      const elapsed = performance.now() - startTime;
      console.log("🔥 WARM CACHE:", elapsed.toFixed(2), "ms");
      return warmResult;
    }

    // Cache mémoire DÉSACTIVÉ
    
    // 3. Vérifier si déjà en cours de récupération
    if (this.promisePool.has(songUrl)) {
      console.log("⏳ Réutilisation promesse existante");
      return await this.promisePool.get(songUrl)!;
    }

    // 4. Streaming ultra-agressif avec parallélisation
    const promise = this.ultraAggressiveStreaming(songUrl, startTime);
    this.promisePool.set(songUrl, promise);

    try {
      const result = await promise;
      
      // Promouvoir vers tous les caches
      this.promoteToAllCaches(songUrl, result);
      
      return result;
    } finally {
      this.promisePool.delete(songUrl);
    }
  }

  /**
   * Streaming ultra-agressif avec parallélisation IndexedDB + réseau
   */
  private static async ultraAggressiveStreaming(songUrl: string, startTime: number): Promise<string> {
    console.log("🚀 Démarrage streaming agressif");

    // Lancer IndexedDB et réseau en parallèle
    const indexedDBPromise = this.tryIndexedDB(songUrl);
    const networkPromise = this.tryNetwork(songUrl);

    // Course entre IndexedDB et réseau
    try {
      const result = await Promise.race([
        indexedDBPromise.then(result => {
          if (result) {
            const elapsed = performance.now() - startTime;
            console.log("💾 INDEXEDDB WIN:", elapsed.toFixed(2), "ms");
            return result;
          }
          return Promise.reject("No IndexedDB result");
        }),
        networkPromise.then(result => {
          if (result) {
            const elapsed = performance.now() - startTime;
            console.log("🌐 NETWORK WIN:", elapsed.toFixed(2), "ms");
            return result;
          }
          return Promise.reject("No network result");
        })
      ]);

      return result;
    } catch (raceError) {
      // Si la course échoue, attendre le réseau
      console.log("⚠️ Course échouée, attente réseau...");
      const networkResult = await networkPromise;
      if (networkResult) {
        const elapsed = performance.now() - startTime;
        console.log("🌐 NETWORK FALLBACK:", elapsed.toFixed(2), "ms");
        return networkResult;
      }
      
      throw new Error("Aucune source disponible");
    }
  }

  /**
   * Tentative IndexedDB ultra-rapide
   */
  private static async tryIndexedDB(songUrl: string): Promise<string | null> {
    try {
      const inCache = await isInCache(songUrl);
      if (inCache) {
        const cachedUrl = await getFromCache(songUrl);
        if (cachedUrl && typeof cachedUrl === 'string') {
          return cachedUrl;
        }
      }
      return null;
    } catch (error) {
      console.warn("⚠️ IndexedDB error:", error);
      return null;
    }
  }

  /**
   * Tentative réseau ultra-rapide
   */
  private static async tryNetwork(songUrl: string): Promise<string | null> {
    try {
      const url = await getAudioFileUrl(songUrl);
      if (typeof url === 'string') {
        return url;
      }
      return null;
    } catch (error) {
      console.warn("⚠️ Network error:", error);
      return null;
    }
  }

  /**
   * Promotion vers tous les caches
   */
  private static promoteToAllCaches(songUrl: string, audioUrl: string): void {
    // Warm cache immédiat
    UltraFastCache.setWarm(songUrl, audioUrl);
    
    // Cache mémoire DÉSACTIVÉ
    // memoryCache.set(songUrl, audioUrl);
    
    // L0 cache en arrière-plan avec blob
    setTimeout(async () => {
      try {
        const response = await fetch(audioUrl);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          UltraFastCache.setL0(songUrl, blobUrl, blob);
          console.log("📦 L0 cache promoted:", songUrl);
        }
      } catch (error) {
        console.warn("⚠️ L0 promotion failed:", error);
      }
    }, 10);
  }

  /**
   * Préchargement batch ultra-optimisé
   */
  static async preloadBatch(songUrls: string[]): Promise<void> {
    console.log("🚀 BATCH PRELOAD:", songUrls.length, "URLs");
    
    // Filtrer les URLs déjà en cache
    const urlsToPreload = songUrls.filter(url => 
      !UltraFastCache.hasL0(url) && !UltraFastCache.getWarm(url)
    );
    
    if (urlsToPreload.length === 0) {
      console.log("✅ Tous déjà en cache");
      return;
    }
    
    console.log("📡 Préchargement de", urlsToPreload.length, "URLs");
    
    // Précharger avec délai échelonné
    const promises = urlsToPreload.map((url, index) => 
      new Promise<void>(resolve => 
        setTimeout(async () => {
          try {
            await this.getAudioUrlUltraFast(url);
          } catch (error) {
            console.warn("⚠️ Préchargement échoué:", url);
          }
          resolve();
        }, index * 50) // 50ms entre chaque requête
      )
    );
    
    await Promise.allSettled(promises);
    console.log("✅ Batch preload terminé");
  }

  /**
   * Statistiques du système ultra-rapide
   */
  static getStats() {
    return {
      activePromises: this.promisePool.size,
      totalRequests: this.requestCount,
      l0Stats: UltraFastCache.getStats()
    };
  }
}