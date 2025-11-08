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
      console.log('[UltraFastStreaming.getAudioUrlUltraFast] ✅ filePath est déjà une URL directe. Tentative de téléchargement et mise en cache...');
      // Même pour une URL directe, on télécharge et on met en cache pour la reprise.
      return await this.streamingDirect(filePath, songTitle, songArtist, songId, true);
    }

    // Priorité 3: Piste TIDAL (si le filePath est un ID Tidal)
    const tidalId = filePath?.startsWith('tidal:') ? filePath.split(':')[1] : undefined;
    if (tidalId) {
      console.log('[UltraFastStreaming.getAudioUrlUltraFast] Tentative de récupération du flux Tidal en priorité...');
      try {
        const result = await getTidalStreamUrl(tidalId);
        if (result?.url) {
          console.log('✅ [UltraFastStreaming.getAudioUrlUltraFast] Flux Tidal récupéré avec succès. On ne met pas en cache les flux Tidal.');
          return { url: result.url };
        }
        throw new Error('URL de flux Tidal non trouvée.');
      } catch (error) {
        console.warn('⚠️ [UltraFastStreaming.getAudioUrlUltraFast] Échec de la récupération du flux Tidal, fallback vers les caches/réseau direct:', error);
      }
    }

    // Priorité 4: Cache mémoire (ultra-rapide) - Moins pertinent avec la nouvelle logique mais gardé pour la forme
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

    // 6. Téléchargement, mise en cache, PUIS lecture.
    console.log("[UltraFastStreaming.getAudioUrlUltraFast] Aucune URL en cache. Lancement du téléchargement et de la mise en cache.");
    const promise = this.streamingDirect(filePath, songTitle, songArtist, songId);
    this.promisePool.set(filePath, promise);

    try {
      const result = await promise;
      console.log("[UltraFastStreaming.getAudioUrlUltraFast] ✅ Chanson téléchargée, mise en cache et prête à être lue depuis le blob local.");
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
   * Télécharge, met en cache, puis retourne une URL locale (Blob URL).
   */
  private static async streamingDirect(
    filePath: string,
    songTitle?: string,
    songArtist?: string,
    songId?: string,
    isDirectUrl = false
  ): Promise<{ url: string; duration?: number }> {
    console.log("🚀 [UltraFastStreaming.streamingDirect] Démarrage du téléchargement pour mise en cache:", filePath);
    const startTime = performance.now();

    try {
      let audioUrl: string | undefined;
      let duration: number | undefined;

      if (isDirectUrl) {
        audioUrl = filePath;
      } else {
        const result = await getAudioFileUrl(filePath, songTitle, songArtist, songId);
        audioUrl = result?.url;
        duration = result?.duration;
      }

      if (!audioUrl) {
        throw new Error("Impossible d'obtenir une URL source pour le téléchargement.");
      }

      console.log(`[STREAMING] Téléchargement depuis: ${audioUrl.substring(0, 100)}...`);
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log(`[STREAMING] Téléchargement terminé. Taille: ${(blob.size / 1024 / 1024).toFixed(2)} MB.`);

      // Mise en cache (maintenant une étape bloquante)
      await cacheCurrentSong(filePath, blob, songId || filePath, songTitle);
      
      // Créer une URL locale à partir du Blob téléchargé
      const blobUrl = URL.createObjectURL(blob);
      
      const elapsed = performance.now() - startTime;
      console.log("✅ [UltraFastStreaming.streamingDirect] Téléchargement et mise en cache réussis en", elapsed.toFixed(2), "ms.");
      
      return { url: blobUrl, duration };

    } catch (error) {
      console.error("❌ [UltraFastStreaming.streamingDirect] Erreur lors du téléchargement et de la mise en cache:", error);
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
        console.log(`[UltraFastStreaming.tryNetwork] ✅ URL obtenue de getAudioFileUrl: ${result.url.substring(0, 100)}...`);
        // La validation HEAD est supprimée car elle est incompatible avec les URL signées de Supabase.
        return result;
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