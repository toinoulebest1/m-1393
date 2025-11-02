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
   * Obtention URL ultra-rapide sans cache
   */
  static async getAudioUrlUltraFast(songUrl: string, deezerId?: string, tidalId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<string> {
    const startTime = performance.now();
    this.requestCount++;
    
    console.log("🚀 Ultra-fast streaming (no cache):", songUrl);

    // Vérifier si déjà en cours de récupération
    if (this.promisePool.has(songUrl)) {
      console.log("⏳ Réutilisation promesse existante");
      return await this.promisePool.get(songUrl)!;
    }

    // Streaming direct sans cache
    const promise = this.streamingDirect(songUrl, startTime, deezerId, tidalId, songTitle, songArtist, songId);
    this.promisePool.set(songUrl, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.promisePool.delete(songUrl);
    }
  }

  /**
   * Streaming direct optimisé
   */
  private static async streamingDirect(songUrl: string, startTime: number, deezerId?: string, tidalId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<string> {
    console.log("🚀 Streaming direct");

    try {
      const result = await this.tryNetwork(songUrl, deezerId, tidalId, songTitle, songArtist, songId);
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
  private static async tryNetwork(songUrl: string, deezerId?: string, tidalId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<string | null> {
    try {
      const url = await getAudioFileUrl(songUrl, deezerId, songTitle, songArtist, tidalId, songId);
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
   * Statistiques du système ultra-rapide
   */
  static getStats() {
    return {
      activePromises: this.promisePool.size,
      totalRequests: this.requestCount
    };
  }
}
