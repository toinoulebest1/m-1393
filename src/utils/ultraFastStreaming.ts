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
    const reqId = this.requestCount;
    console.log(`[STREAMING] #${reqId} | START | getAudioUrlUltraFast | Path: "${filePath}", ID: ${songId || 'N/A'}`);

    // Priorité 1: Cache IndexedDB (pour la restauration de session)
    console.log(`[STREAMING] #${reqId} | STEP 1 | Checking IndexedDB cache for key: "${filePath}"`);
    const cachedBlobUrl = await getFromCache(filePath);
    if (cachedBlobUrl) {
      console.log(`[STREAMING] #${reqId} | SUCCESS | Found in IndexedDB. Returning blob URL.`);
      return { url: cachedBlobUrl };
    }
    console.log(`[STREAMING] #${reqId} | INFO | Not found in IndexedDB.`);

    // Priorité 2: Piste TIDAL (si le filePath est un ID Tidal)
    const tidalId = filePath?.startsWith('tidal:') ? filePath.split(':')[1] : undefined;
    if (tidalId) {
      console.log(`[STREAMING] #${reqId} | INFO | Tidal track detected. ID: ${tidalId}. Attempting to get stream URL...`);
      try {
        const tidalStream = await getTidalStreamUrl(tidalId);
        if (tidalStream?.url) {
          console.log(`[STREAMING] #${reqId} | INFO | Tidal stream URL obtained. Now treating it as a direct URL to download and cache.`);
          // On a l'URL du flux, maintenant on la télécharge et la met en cache.
          // Le `filePath` (ex: 'tidal:12345') est utilisé comme clé de cache.
          return await this.streamingDirect(filePath, songTitle, songArtist, songId, false, reqId, tidalStream.url);
        }
        throw new Error('URL de flux Tidal non trouvée.');
      } catch (error) {
        console.warn(`[STREAMING] #${reqId} | WARN | Failed to get Tidal stream.`, error);
        // On laisse tomber pour ne pas essayer d'autres méthodes qui échoueront
        throw error;
      }
    }

    // Priorité 3: Si filePath est déjà une URL HTTP/HTTPS directe
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      console.log(`[STREAMING] #${reqId} | INFO | Path is a direct HTTP(S) URL. Starting download & cache process.`);
      return await this.streamingDirect(filePath, songTitle, songArtist, songId, true, reqId);
    }

    // Priorité 4: Cache mémoire (ultra-rapide)
    console.log(`[STREAMING] #${reqId} | STEP 2 | Checking memory cache...`);
    const cachedMemoryUrl = memoryCache.get(filePath);
    if (cachedMemoryUrl) {
      console.log(`[STREAMING] #${reqId} | SUCCESS | Found in memory cache. Returning URL.`);
      return { url: cachedMemoryUrl };
    }
    console.log(`[STREAMING] #${reqId} | INFO | Not found in memory cache.`);

    // 5. Vérifier si déjà en cours de récupération
    if (this.promisePool.has(filePath)) {
      console.log(`[STREAMING] #${reqId} | INFO | Promise for this path already in pool. Awaiting result.`);
      return await this.promisePool.get(filePath)!;
    }

    // 6. Téléchargement, mise en cache, PUIS lecture (pour les fichiers locaux Supabase)
    console.log(`[STREAMING] #${reqId} | ACTION | No cache hit. Initiating download & cache process for local file.`);
    const promise = this.streamingDirect(filePath, songTitle, songArtist, songId, false, reqId);
    this.promisePool.set(filePath, promise);

    try {
      const result = await promise;
      console.log(`[STREAMING] #${reqId} | SUCCESS | Download & cache process finished. Ready for playback from local blob.`);
      if (result.duration) {
        console.log(`[STREAMING] #${reqId} | INFO | Duration retrieved:`, result.duration, "seconds");
      }
      return result;
    } finally {
      this.promisePool.delete(filePath);
      console.log(`[STREAMING] #${reqId} | CLEANUP | Promise removed from pool.`);
    }
  }

  /**
   * Télécharge, met en cache, puis retourne une URL locale (Blob URL).
   * @param filePath - La clé à utiliser pour le cache (ex: 'song.mp3' ou 'tidal:12345')
   * @param sourceUrlOverride - L'URL réelle à télécharger (ex: l'URL du flux Tidal)
   */
  private static async streamingDirect(
    filePath: string, // Clé de cache
    songTitle?: string,
    songArtist?: string,
    songId?: string,
    isDirectUrl = false,
    reqId?: number,
    sourceUrlOverride?: string // URL de téléchargement
  ): Promise<{ url: string; duration?: number }> {
    const logPrefix = `[STREAMING] #${reqId || 'N/A'} | streamingDirect |`;
    console.log(`${logPrefix} START | Cache Key: "${filePath}"`);
    const startTime = performance.now();

    try {
      let audioUrl: string | undefined;
      let duration: number | undefined;

      if (sourceUrlOverride) {
        audioUrl = sourceUrlOverride;
        console.log(`${logPrefix} INFO | Using provided source URL override.`);
      } else if (isDirectUrl) {
        audioUrl = filePath;
        console.log(`${logPrefix} INFO | Using direct URL provided (filePath is the source).`);
      } else {
        console.log(`${logPrefix} ACTION | Calling getAudioFileUrl to get a temporary source URL...`);
        const result = await getAudioFileUrl(filePath, songTitle, songArtist, songId);
        audioUrl = result?.url;
        duration = result?.duration;
        console.log(`${logPrefix} INFO | getAudioFileUrl returned URL: ${audioUrl ? 'YES' : 'NO'}`);
      }

      if (!audioUrl) {
        throw new Error("Impossible d'obtenir une URL source pour le téléchargement.");
      }

      console.log(`${logPrefix} ACTION | Fetching from source URL: ${audioUrl.substring(0, 100)}...`);
      const response = await fetch(audioUrl);
      console.log(`${logPrefix} INFO | Fetch response status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log(`${logPrefix} ACTION | Converting response to blob...`);
      const blob = await response.blob();
      console.log(`${logPrefix} SUCCESS | Blob created. Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB. Type: ${blob.type}`);

      // Mise en cache en utilisant `filePath` comme clé
      console.log(`${logPrefix} ACTION | Calling cacheCurrentSong to save blob to IndexedDB with key "${filePath}"...`);
      await cacheCurrentSong(filePath, blob, songId || filePath, songTitle);
      console.log(`${logPrefix} SUCCESS | cacheCurrentSong finished.`);
      
      // Créer une URL locale à partir du Blob téléchargé
      console.log(`${logPrefix} ACTION | Creating blob URL for playback...`);
      const blobUrl = URL.createObjectURL(blob);
      console.log(`${logPrefix} SUCCESS | Blob URL created: ${blobUrl.substring(0, 50)}...`);
      
      const elapsed = performance.now() - startTime;
      console.log(`${logPrefix} COMPLETE | Download and cache successful in ${elapsed.toFixed(2)} ms.`);
      
      return { url: blobUrl, duration };

    } catch (error) {
      const elapsed = performance.now() - startTime;
      console.error(`${logPrefix} FAILED | Error after ${elapsed.toFixed(2)} ms:`, error);
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