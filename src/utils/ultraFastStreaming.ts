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
   */
  public static async getAudioUrlUltraFast(
    filePath: string,
    songTitle?: string,
    songArtist?: string,
    songId?: string
  ): Promise<{ url: string; duration?: number }> {
    this.requestCount++;
    console.log(`[UltraFastStreaming.getAudioUrlUltraFast] Requête #${this.requestCount} pour filePath: "${filePath}" (ID: ${songId || 'N/A'})`);

    // Priorité 1: Cache IndexedDB (pour la restauration de session)
    const cachedBlobUrl = await getFromCache(filePath);
    if (cachedBlobUrl) {
      console.log("[UltraFastStreaming.getAudioUrlUltraFast] ✅ URL récupérée depuis cache IndexedDB (Priorité 1).");
      return { url: cachedBlobUrl };
    }

    // Priorité 2: Si filePath est déjà une URL HTTP/HTTPS directe, la retourner telle quelle.
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      console.log('[UltraFastStreaming.getAudioUrlUltraFast] ✅ filePath est déjà une URL directe. Retourne l\'URL telle quelle.');
      return { url: filePath };
    }

    // Priorité 3: Piste TIDAL (si le filePath est un ID Tidal)
    const tidalId = filePath?.startsWith('tidal:') ? filePath.split(':')[1] : undefined;
    if (tidalId) {
      console.log('[UltraFastStreaming.getAudioUrlUltraFast] Tentative de récupération du flux Tidal en priorité...');
      try {
        const result = await getTidalStreamUrl(tidalId);
        if (result?.url) {
          console.log('✅ [UltraFastStreaming.getAudioUrlUltraFast] Flux Tidal récupéré avec succès.');
          return { url: result.url };
        }
        throw new Error('URL de flux Tidal non trouvée.');
      } catch (error) {
        console.warn('⚠️ [UltraFastStreaming.getAudioUrlUltraFast] Échec de la récupération du flux Tidal, fallback vers les caches/réseau direct:', error);
      }
    }

    // Priorité 4: Cache mémoire (ultra-rapide)
    const cachedMemoryUrl = memoryCache.get(filePath);
    if (cachedMemoryUrl) {
      console.log("[UltraFastStreaming.getAudioUrlUltraFast] ✅ URL récupérée depuis cache mémoire (Priorité 4).");
      return { url: cachedMemoryUrl };
    }

    // 5. Vérifier si déjà en cours de récupération
    if (this.promisePool.has(filePath)) {
      console.log("[UltraFastStreaming.getAudioUrlUltraFast] ⏳ Réutilisation promesse existante pour filePath:", filePath);
      return await this.promisePool.get(filePath)!;
    }

    // 6. Streaming direct via getAudioFileUrl (pour les fichiers locaux)
    console.log("[UltraFastStreaming.getAudioUrlUltraFast] Aucune URL en cache ou promesse existante. Lancement du streaming direct via getAudioFileUrl.");
    const promise = this.streamingDirect(filePath, songTitle, songArtist, songId);
    this.promisePool.set(filePath, promise);

    // Lancer la mise en cache en arrière-plan sans bloquer la lecture
    promise.then(result => {
      if (result && result.url && !result.url.startsWith('blob:')) {
        (async () => {
          try {
            console.log("🚀 Démarrage de la mise en cache en arrière-plan pour:", songTitle);
            const response = await fetch(result.url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            await cacheCurrentSong(filePath, blob, songId || filePath, songTitle);
            console.log("✅ Mise en cache en arrière-plan terminée pour:", songTitle);
          } catch (e) {
            console.error("❌ Échec de la mise en cache en arrière-plan:", e);
          }
        })();
      }
    });

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
    songTitle?: string,
    songArtist?: string,
    songId?: string
  ): Promise<{ url: string; duration?: number }> {
    console.log("🚀 [UltraFastStreaming.streamingDirect] Démarrage du streaming direct pour filePath:", filePath);
    const startTime = performance.now();

    try {
      // Appel à tryNetwork qui utilise getAudioFileUrl pour les chemins locaux
      const result = await this.tryNetwork(filePath, songTitle, songArtist, songId);
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
   * Tentative réseau ultra-rapide (utilise getAudioFileUrl pour les chemins locaux)
   */
private static async tryNetwork(filePath: string, songTitle?: string, songArtist?: string, songId?: string): Promise<{ url: string; duration?: number } | null> {
    console.log(`[UltraFastStreaming.tryNetwork] Tentative de récupération réseau pour filePath: "${filePath}"`);
    try {
      // getAudioFileUrl est maintenant responsable uniquement des fichiers locaux
      const result = await getAudioFileUrl(filePath, songTitle, songArtist, songId);
      if (result && typeof result.url === 'string') {
        console.log(`[UltraFastStreaming.tryNetwork] URL obtenue de getAudioFileUrl: ${result.url.substring(0, 100)}...`);
        // Validation rapide de l'URL pour éviter les liens cassés (500) ou expirés
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
          console.warn(`[UltraFastStreaming.tryNetwork] ⚠️ Validation URL timeout (1500ms) pour: ${songTitle || filePath}`);
        }, 1500);
        try {
          const head = await fetch(result.url, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeout);
          if (head.ok || head.status === 405) { // Certains endpoints ne supportent pas HEAD
            console.log(`[UltraFastStreaming.tryNetwork] ✅ Validation URL réussie (status: ${head.status}) pour: ${songTitle || filePath}`);
            return result;
          }
          console.warn(`[UltraFastStreaming.tryNetwork] ⚠️ Validation URL échouée (status: ${head.status}) pour: ${songTitle || filePath}`);
          return null;
        } catch (e: any) {
          clearTimeout(timeout);
          if (e.name === 'AbortError') {
            // Le timeout a déjà loggé l'erreur
          } else {
            console.warn(`[UltraFastStreaming.tryNetwork] ⚠️ Erreur lors de la validation de l'URL pour: ${songTitle || filePath}`, e);
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
  static async preloadNext(filePath: string): Promise<void> {
    console.log("🔮 [UltraFastStreaming.preloadNext] Démarrage du préchargement en arrière-plan pour:", filePath);
    
    // Ne précharger que si pas déjà en cache
    if (UltraFastCache.hasL0(filePath) || UltraFastCache.getWarm(filePath)) {
      console.log("✅ [UltraFastStreaming.preloadNext] Chanson déjà en cache, pas de préchargement nécessaire.");
      return;
    }
    
    try {
      await this.getAudioUrlUltraFast(filePath);
      console.log("✅ [UltraFastStreaming.preloadNext] Préchargement terminé avec succès pour:", filePath);
    } catch (error) {
      console.warn("⚠️ [UltraFastStreaming.preloadNext] Échec du préchargement pour:", filePath, error);
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