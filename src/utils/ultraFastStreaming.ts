/**
 * Système de streaming audio ultra-rapide
 * Optimisé pour des temps de chargement sub-milliseconde
 */

import { getAudioFileUrl } from './storage';
import { UltraFastCache } from './ultraFastCache';

export class UltraFastStreaming {
  private static promisePool = new Map<string, Promise<string>>();
  private static requestCount = 0;

  /**
   * Obtention URL ultra-rapide avec stratégies parallèles
   */
  static async getAudioUrlUltraFast(songUrl: string, tidalId?: string, songTitle?: string, songArtist?: string): Promise<string> {
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

    // 3. Vérifier si déjà en cours de récupération
    if (this.promisePool.has(songUrl)) {
      console.log("⏳ Réutilisation promesse existante");
      return await this.promisePool.get(songUrl)!;
    }

    // 4. Streaming ultra-agressif
    const promise = this.streamingDirect(songUrl, startTime, tidalId, songTitle, songArtist);
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
   * Streaming direct optimisé
   */
  private static async streamingDirect(songUrl: string, startTime: number, tidalId?: string, songTitle?: string, songArtist?: string): Promise<string> {
    console.log("🚀 Streaming direct");

    try {
      const result = await this.tryNetwork(songUrl, tidalId, songTitle, songArtist);
      if (result) {
        const elapsed = performance.now() - startTime;
        console.log("🌐 NETWORK DIRECT:", elapsed.toFixed(2), "ms");
        return result;
      }
      
      throw new Error("Aucune source disponible");
    } catch (error) {
      console.error("❌ Erreur streaming direct:", error);
      throw error;
    }
  }

  /**
   * Tentative réseau ultra-rapide
   */
  private static async tryNetwork(songUrl: string, tidalId?: string, songTitle?: string, songArtist?: string): Promise<string | null> {
    try {
      const url = await getAudioFileUrl(songUrl, tidalId, songTitle, songArtist);
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
   * Préchargement de la chanson suivante en arrière-plan
   */
  static async preloadNext(songUrl: string): Promise<void> {
    console.log("🔮 Préchargement arrière-plan:", songUrl);
    
    // Ne précharger que si pas déjà en cache
    if (UltraFastCache.hasL0(songUrl) || UltraFastCache.getWarm(songUrl)) {
      console.log("✅ Déjà en cache");
      return;
    }
    
    try {
      await this.getAudioUrlUltraFast(songUrl);
      console.log("✅ Préchargement terminé:", songUrl);
    } catch (error) {
      console.warn("⚠️ Échec préchargement:", error);
    }
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
