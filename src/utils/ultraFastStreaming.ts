/**
 * Système de streaming audio ultra-rapide
 * Optimisé pour des temps de chargement sub-milliseconde
 */

import { getAudioFileUrl } from './storage';
import { UltraFastCache } from './ultraFastCache';
import { supabase } from '@/integrations/supabase/client';
import { getFromCache, cacheCurrentSong } from './audioCache';
import { memoryCache } from './memoryCache';
import { getTidalStreamUrl } from '@/services/tidalService';

export class UltraFastStreaming {
  private static instance: UltraFastStreaming;
  private static promisePool = new Map<string, Promise<{ url: string; duration?: number }>>();
  private static requestCount = 0;

  /**
   * Obtention URL ultra-rapide avec stratégies parallèles
   * CACHE DÉSACTIVÉ pour debug
   */
  public static async getAudioUrlUltraFast(
    filePath: string,
    songTitle?: string,
    songArtist?: string,
    songId?: string,
    tidalId?: string
  ): Promise<{ url: string; duration?: number }> {
    const effectiveTidalId = tidalId || (filePath?.startsWith('tidal:') ? filePath.split(':')[1] : undefined);

    // Priorité 1: Piste TIDAL
    if (effectiveTidalId) {
      try {
        console.log('⚡️ Tentative de récupération du flux Tidal...');
        const result = await getTidalStreamUrl(effectiveTidalId);
        if (result?.url) {
          console.log('✅ Flux Tidal récupéré avec succès');
          return { url: result.url };
        }
        throw new Error('URL de flux Tidal non trouvée.');
      } catch (error) {
        console.warn('⚠️ Échec de la récupération du flux Tidal, fallback...', error);
      }
    }

    // Priorité 2: Cache mémoire (ultra-rapide)
    const cachedMemoryUrl = memoryCache.get(filePath);
    if (cachedMemoryUrl) {
      console.log("✅ URL récupérée depuis cache mémoire:", cachedMemoryUrl.substring(0, 100) + "...");
      return { url: cachedMemoryUrl };
    }

    // CACHE DÉSACTIVÉ - toujours récupérer depuis le réseau
    // 1. Vérifier si déjà en cours de récupération
    if (this.promisePool.has(filePath)) {
      console.log("⏳ Réutilisation promesse existante");
      return await this.promisePool.get(filePath)!;
    }

    // 2. Streaming direct
    const promise = this.streamingDirect(filePath, filePath, songTitle, songArtist, songId, effectiveTidalId);
    this.promisePool.set(filePath, promise);

    try {
      const result = await promise;
      console.log("✅ URL récupérée depuis le réseau:", result.url.substring(0, 100) + "...");
      if (result.duration) {
        console.log("✅ Durée récupérée:", result.duration, "secondes");
      }
      return result;
    } finally {
      this.promisePool.delete(filePath);
    }
  }

  /**
   * Streaming direct optimisé
   */
  private static async streamingDirect(
    filePath: string,
    songUrl: string,
    songTitle?: string,
    songArtist?: string,
    songId?: string,
    tidalId?: string
  ): Promise<{ url: string; duration?: number }> {
    console.log("🚀 Streaming direct");

    try {
      const result = await this.tryNetwork(songUrl, songTitle, songArtist, songId);
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
private static async tryNetwork(songUrl: string, songTitle?: string, songArtist?: string, songId?: string): Promise<{ url: string; duration?: number } | null> {
    try {
      const result = await getAudioFileUrl(songUrl, songTitle, songArtist, songId);
      if (result && typeof result.url === 'string') {
        // Validation rapide de l'URL pour éviter les liens cassés (500) ou expirés
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        try {
          const head = await fetch(result.url, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeout);
          if (head.ok || head.status === 405) { // Certains endpoints ne supportent pas HEAD
            return result;
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