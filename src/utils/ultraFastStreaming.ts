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
  private static preloadedFromDB = false;
  private static deezmateCache = new Map<string, { url: string, timestamp: number }>();
  private static DEEZMATE_CACHE_TTL = 50000; // 50 secondes (expire à 60s)

  /**
   * Préchargement massif depuis la DB au démarrage
   */
  static async preloadFromDatabase(): Promise<void> {
    if (this.preloadedFromDB) return;
    
    console.log("🚀 Préchargement URLs depuis tidal_audio_links...");
    
    try {
      // Récupérer toutes les URLs en cache depuis la DB
      const { data: cachedLinks } = await supabase
        .from('tidal_audio_links')
        .select('tidal_id, audio_url')
        .limit(100);
      
      if (cachedLinks && cachedLinks.length > 0) {
        // Charger directement dans le warm cache
        for (const link of cachedLinks) {
          // Utiliser tidal:{id} comme clé pour correspondre au format des songs
          UltraFastCache.setWarm(`tidal:${link.tidal_id}`, link.audio_url);
        }
        console.log(`✅ ${cachedLinks.length} URLs préchargées dans le warm cache`);
      }
      
      this.preloadedFromDB = true;
    } catch (error) {
      console.error("⚠️ Échec préchargement DB:", error);
    }
  }

  /**
   * Obtention URL ultra-rapide avec stratégies parallèles
   */
  static async getAudioUrlUltraFast(songUrl: string, deezerId?: string, tidalId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<string> {
    const startTime = performance.now();
    this.requestCount++;
    
    // Précharger depuis la DB au premier appel
    if (!this.preloadedFromDB) {
      await this.preloadFromDatabase();
    }
    
    console.log("🚀 Ultra-fast streaming:", songUrl);
    
    // 0. Cache Deezmate si deezerId disponible (< 1ms)
    if (deezerId) {
      const cached = this.deezmateCache.get(deezerId);
      if (cached && (Date.now() - cached.timestamp) < this.DEEZMATE_CACHE_TTL) {
        const elapsed = performance.now() - startTime;
        console.log("⚡ DEEZMATE CACHE:", elapsed.toFixed(2), "ms");
        return cached.url;
      }
    }
    
    // Si on a un tidal_id, vérifier d'abord avec le format tidal:{id}
    if (tidalId) {
      const tidalKey = `tidal:${tidalId}`;
      const warmResult = UltraFastCache.getWarm(tidalKey);
      if (warmResult) {
        const elapsed = performance.now() - startTime;
        console.log("🔥 TIDAL WARM CACHE:", elapsed.toFixed(2), "ms");
        return warmResult;
      }
    }

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
    const promise = this.streamingDirect(songUrl, startTime, deezerId, tidalId, songTitle, songArtist, songId);
    this.promisePool.set(songUrl, promise);

    try {
      const result = await promise;
      
      // Promouvoir vers tous les caches
      this.promoteToAllCaches(songUrl, result, deezerId);
      
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
   * Promotion vers tous les caches
   */
  private static promoteToAllCaches(songUrl: string, audioUrl: string, deezerId?: string): void {
    // Warm cache immédiat
    UltraFastCache.setWarm(songUrl, audioUrl);
    
    // Cache Deezmate si URL provient de Deezmate
    if (deezerId && audioUrl.includes('deezmate')) {
      this.deezmateCache.set(deezerId, { url: audioUrl, timestamp: Date.now() });
      console.log("💾 Deezmate cached:", deezerId);
    }
    
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
  static async preloadNext(songUrl: string, deezerId?: string, tidalId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<void> {
    console.log("🔮 Préchargement arrière-plan:", songUrl);
    
    // Vérifier cache Deezmate en premier
    if (deezerId) {
      const cached = this.deezmateCache.get(deezerId);
      if (cached && (Date.now() - cached.timestamp) < this.DEEZMATE_CACHE_TTL) {
        console.log("✅ Déjà en cache Deezmate");
        return;
      }
    }
    
    // Ne précharger que si pas déjà en cache
    if (UltraFastCache.hasL0(songUrl) || UltraFastCache.getWarm(songUrl)) {
      console.log("✅ Déjà en cache");
      return;
    }
    
    try {
      await this.getAudioUrlUltraFast(songUrl, deezerId, tidalId, songTitle, songArtist, songId);
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
