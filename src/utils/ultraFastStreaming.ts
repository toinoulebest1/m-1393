/**
 * Système de streaming audio ultra-rapide
 * Optimisé pour des temps de chargement sub-milliseconde
 */

import { getAudioFileUrl } from './storage';
import { UltraFastCache } from './ultraFastCache';
import { supabase } from '@/integrations/supabase/client';

export class UltraFastStreaming {
  private static promisePool = new Map<string, Promise<string>>();
  private static requestCount = 0;

  /**
   * Obtention URL ultra-rapide avec stratégies parallèles
   * CACHE DÉSACTIVÉ pour debug
   */
  static async getAudioUrlUltraFast(songUrl: string, deezerId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<string> {
    const startTime = performance.now();
    this.requestCount++;
    
    console.log("🚀 Ultra-fast streaming (SANS CACHE):", songUrl);

    // CACHE DÉSACTIVÉ - toujours récupérer depuis le réseau
    // 1. Vérifier si déjà en cours de récupération
    if (this.promisePool.has(songUrl)) {
      console.log("⏳ Réutilisation promesse existante");
      return await this.promisePool.get(songUrl)!;
    }

    // 2. Streaming direct
    const promise = this.streamingDirect(songUrl, startTime, deezerId, songTitle, songArtist, songId);
    this.promisePool.set(songUrl, promise);

    try {
      const result = await promise;
      console.log("✅ URL récupérée depuis le réseau:", result.substring(0, 100) + "...");
      return result;
    } finally {
      this.promisePool.delete(songUrl);
    }
  }

  /**
   * Streaming direct optimisé
   */
  private static async streamingDirect(songUrl: string, startTime: number, deezerId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<string> {
    console.log("🚀 Streaming direct");

    try {
      const result = await this.tryNetwork(songUrl, deezerId, songTitle, songArtist, songId);
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
private static async tryNetwork(songUrl: string, deezerId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<string | null> {
    try {
      const url = await getAudioFileUrl(songUrl, deezerId, songTitle, songArtist, songId);
      if (typeof url === 'string') {
        // Validation rapide de l'URL pour éviter les liens cassés (500) ou expirés
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        try {
          const head = await fetch(url, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeout);
          if (head.ok || head.status === 405) { // Certains endpoints ne supportent pas HEAD
            return url;
          }
          console.warn("⚠️ Validation URL échouée:", head.status, songTitle || songUrl);
          return null;
        } catch (e) {
          clearTimeout(timeout);
          console.warn("⚠️ Validation URL timeout/échec:", songTitle || songUrl);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.warn("⚠️ Network error:", error);
      return null;
    }
  }

  /**
   * Promotion vers warm cache uniquement (URLs légères)
   * L0 cache désactivé pour éviter le téléchargement de Blobs lourds
   */
  private static promoteToAllCaches(songUrl: string, audioUrl: string): void {
    // Warm cache uniquement (< 0.5ms, ultra-léger)
    UltraFastCache.setWarm(songUrl, audioUrl);
    console.log("🔥 URL promue vers warm cache:", songUrl);
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
