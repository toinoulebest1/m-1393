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
    this.requestCount++;
    console.log(`[UltraFastStreaming.getAudioUrlUltraFast] Requête #${this.requestCount} pour filePath: "${filePath}" (Tidal ID: ${tidalId || 'N/A'})`);
    const effectiveTidalId = tidalId || (filePath?.startsWith('tidal:') ? filePath.split(':')[1] : undefined);

    // Priorité 1: Piste TIDAL
    if (effectiveTidalId) {
      console.log('[UltraFastStreaming.getAudioUrlUltraFast] Tentative de récupération du flux Tidal en priorité...');
      try {
        const result = await getTidalStreamUrl(effectiveTidalId);
        if (result?.url) {
          console.log('✅ [UltraFastStreaming.getAudioUrlUltraFast] Flux Tidal récupéré avec succès.');
          return { url: result.url };
        }
        throw new Error('URL de flux Tidal non trouvée.');
      } catch (error) {
        console.warn('⚠️ [UltraFastStreaming.getAudioUrlUltraFast] Échec de la récupération du flux Tidal, fallback vers les caches/réseau direct:', error);
      }
    }

    // Priorité 2: Cache mémoire (ultra-rapide)
    const cachedMemoryUrl = memoryCache.get(filePath);
    if (cachedMemoryUrl) {
      console.log("[UltraFastStreaming.getAudioUrlUltraFast] ✅ URL récupérée depuis cache mémoire (Priorité 2).");
      return { url: cachedMemoryUrl };
    }

    // CACHE DÉSACTIVÉ pour debug - toujours récupérer depuis le réseau
    // 1. Vérifier si déjà en cours de récupération
    if (this.promisePool.has(filePath)) {
      console.log("[UltraFastStreaming.getAudioUrlUltraFast] ⏳ Réutilisation promesse existante pour filePath:", filePath);
      return await this.promisePool.get(filePath)!;
    }

    // 2. Streaming direct
    console.log("[UltraFastStreaming.getAudioUrlUltraFast] Aucune URL en cache ou promesse existante. Lancement du streaming direct.");
    const promise = this.streamingDirect(filePath, filePath, songTitle, songArtist, songId, effectiveTidalId);
    this.promisePool.set(filePath, promise);

    try {
      const result = await promise;
      console.log("[UltraFastStreaming.getAudioUrlUltraFast] ✅ URL récupérée depuis le réseau via streaming direct.");
      if (result.duration) {
        console.log("✅ Durée récupérée:", result.duration, "secondes");
      }
      return result;
    } finally {
      this.promisePool.delete(filePath);
      console.log("[UltraFastStreaming.getAudioUrlUltraFast] Promesse supprimée du pool pour filePath:", filePath);
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
    console.log("🚀 [UltraFastStreaming.streamingDirect] Démarrage du streaming direct pour filePath:", filePath);
    const startTime = performance.now(); // Déplacé ici pour mesurer le temps du tryNetwork

    try {
      const result = await this.tryNetwork(songUrl, songTitle, songArtist, songId);
      if (result) {
        const elapsed = performance.now() - startTime;
        console.log("🌐 [UltraFastStreaming.streamingDirect] Récupération réseau directe réussie en", elapsed.toFixed(2), "ms.");
        return result;
      }
      
      throw new Error("Aucune source audio disponible via le réseau direct.");
    } catch (error) {
      console.error("❌ [UltraFastStreaming.streamingDirect] Erreur lors du streaming direct:", error);
      throw error;
    }
  }

  /**
   * Tentative réseau ultra-rapide
   */
private static async tryNetwork(songUrl: string, songTitle?: string, songArtist?: string, songId?: string): Promise<{ url: string; duration?: number } | null> {
    console.log(`[UltraFastStreaming.tryNetwork] Tentative de récupération réseau pour songUrl: "${songUrl}"`);
    try {
      const result = await getAudioFileUrl(songUrl, songTitle, songArtist, songId);
      if (result && typeof result.url === 'string') {
        console.log(`[UltraFastStreaming.tryNetwork] URL obtenue de getAudioFileUrl: ${result.url.substring(0, 100)}...`);
        // Validation rapide de l'URL pour éviter les liens cassés (500) ou expirés
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
          console.warn(`[UltraFastStreaming.tryNetwork] ⚠️ Validation URL timeout (1500ms) pour: ${songTitle || songUrl}`);
        }, 1500);
        try {
          const head = await fetch(result.url, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeout);
          if (head.ok || head.status === 405) { // Certains endpoints ne supportent pas HEAD
            console.log(`[UltraFastStreaming.tryNetwork] ✅ Validation URL réussie (status: ${head.status}) pour: ${songTitle || songUrl}`);
            return result;
          }
          console.warn(`[UltraFastStreaming.tryNetwork] ⚠️ Validation URL échouée (status: ${head.status}) pour: ${songTitle || songUrl}`);
          return null;
        } catch (e: any) {
          clearTimeout(timeout);
          if (e.name === 'AbortError') {
            // Le timeout a déjà loggé l'erreur
          } else {
            console.warn(`[UltraFastStreaming.tryNetwork] ⚠️ Erreur lors de la validation de l'URL pour: ${songTitle || songUrl}`, e);
          }
          return null;
        }
      }
      console.log('[UltraFastStreaming.tryNetwork] getAudioFileUrl n\'a pas retourné d\'URL valide.');
      return null;
    } catch (error) {
      console.warn("⚠️ [UltraFastStreaming.tryNetwork] Erreur réseau lors de l'appel à getAudioFileUrl:", error);
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
    console.log("🔥 [UltraFastStreaming.promoteToAllCaches] URL promue vers warm cache:", songUrl);
  }

  /**
   * Préchargement de la chanson suivante en arrière-plan
   */
  static async preloadNext(songUrl: string): Promise<void> {
    console.log("🔮 [UltraFastStreaming.preloadNext] Démarrage du préchargement en arrière-plan pour:", songUrl);
    
    // Ne précharger que si pas déjà en cache
    if (UltraFastCache.hasL0(songUrl) || UltraFastCache.getWarm(songUrl)) {
      console.log("✅ [UltraFastStreaming.preloadNext] Chanson déjà en cache, pas de préchargement nécessaire.");
      return;
    }
    
    try {
      await this.getAudioUrlUltraFast(songUrl);
      console.log("✅ [UltraFastStreaming.preloadNext] Préchargement terminé avec succès pour:", songUrl);
    } catch (error) {
      console.warn("⚠️ [UltraFastStreaming.preloadNext] Échec du préchargement pour:", songUrl, error);
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