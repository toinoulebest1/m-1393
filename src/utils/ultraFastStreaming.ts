/**
 * Système de streaming audio ultra-rapide
 * Optimisé pour des temps de chargement sub-milliseconde
 */

import { getAudioFileUrl } from './storage';
import { UltraFastCache } from './ultraFastCache';
import { supabase } from '@/integrations/supabase/client';
import { getFromCache, cacheCurrentSong, isInCache } from './audioCache';
import { memoryCache } from './memoryCache';
import { getTidalStreamUrl } from '@/services/tidalService';

export class UltraFastStreaming {
  private static instance: UltraFastStreaming;
  private static promisePool = new Map<string, Promise<{ url: string; duration?: number }>>();
  private static requestCount = 0;

  /**
   * Lance le processus de mise en cache en arrière-plan sans bloquer la lecture.
   */
  private static async backgroundCache(
    cacheKey: string,
    sourceUrl: string,
    songId?: string,
    songTitle?: string
  ): Promise<void> {
    const logPrefix = `[BACKGROUND_CACHE] | Key: "${cacheKey}" |`;
    console.log(`${logPrefix} START`);

    try {
      // Vérifier une dernière fois si un autre processus ne l'a pas déjà mis en cache
      if (await isInCache(cacheKey)) {
        console.log(`${logPrefix} ABORTED: Already in cache.`);
        return;
      }

      console.log(`${logPrefix} Fetching from source: ${sourceUrl.substring(0, 100)}...`);
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      console.log(`${logPrefix} Blob created. Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB.`);

      await cacheCurrentSong(cacheKey, blob, songId || cacheKey, songTitle);
      console.log(`${logPrefix} SUCCESS: Caching complete.`);
    } catch (error) {
      console.error(`${logPrefix} FAILED:`, error);
    }
  }

  /**
   * Obtention URL ultra-rapide avec stratégies parallèles
   */
  public static async getAudioUrlUltraFast(
    filePath: string,
    songTitle?: string,
    songArtist?: string,
    songId?: string
  ): Promise<{ url:string; duration?: number }> {
    this.requestCount++;
    const reqId = this.requestCount;
    const logPrefix = `[STREAMING] #${reqId} | Path: "${filePath}" |`;
    console.log(`${logPrefix} START`);

    // Priorité 1: Cache IndexedDB (le plus rapide pour les lectures répétées)
    console.log(`${logPrefix} STEP 1: Checking IndexedDB...`);
    const cachedBlobUrl = await getFromCache(filePath);
    if (cachedBlobUrl) {
      console.log(`${logPrefix} SUCCESS: Found in IndexedDB. Returning blob URL.`);
      return { url: cachedBlobUrl };
    }
    console.log(`${logPrefix} INFO: Not in IndexedDB.`);

    // Si pas dans le cache, on obtient une URL distante pour la lecture immédiate
    // et on lance la mise en cache en arrière-plan.

    let remoteStream: { url: string; duration?: number } | null = null;
    const isTidal = filePath.startsWith('tidal:');
    const isHttp = filePath.startsWith('http');

    try {
      if (isTidal) {
        const tidalId = filePath.split(':')[1];
        console.log(`${logPrefix} STEP 2: Getting Tidal stream URL via proxy...`);
        // Obtenir l'URL directe de Tidal via le service, puis la passer au proxy
        const directTidalUrlResult = await getTidalStreamUrl(tidalId);
        if (!directTidalUrlResult || !directTidalUrlResult.url) {
          throw new Error("Impossible d'obtenir l'URL directe de Tidal.");
        }
        // Construire l'URL du proxy Edge Function
        const proxyUrl = `https://pwknncursthenghqgevl.supabase.co/functions/v1/audio-proxy?src=${encodeURIComponent(directTidalUrlResult.url)}`;
        remoteStream = { url: proxyUrl }; // Le proxy gérera le transcodage si nécessaire
      } else if (isHttp) {
        console.log(`${logPrefix} STEP 2: Path is a direct HTTP URL.`);
        remoteStream = { url: filePath };
      } else {
        console.log(`${logPrefix} STEP 2: Getting Supabase/local file URL...`);
        remoteStream = await getAudioFileUrl(filePath, songTitle, songArtist, songId);
      }

      if (!remoteStream || !remoteStream.url) {
        throw new Error("Impossible d'obtenir une URL de streaming distante.");
      }

      console.log(`${logPrefix} SUCCESS: Got remote URL for instant playback: ${remoteStream.url.substring(0, 100)}...`);

      // Lancer la mise en cache en arrière-plan SANS l'attendre (ne pas mettre await ici)
      // Pour les pistes Tidal, nous mettons en cache l'URL du proxy, pas l'URL directe de Tidal.
      // Le proxy est censé renvoyer un flux compatible.
      this.backgroundCache(filePath, remoteStream.url, songId, songTitle);

      // Retourner immédiatement l'URL distante pour que la lecture commence
      return remoteStream;

    } catch (error) {
      console.error(`${logPrefix} FAILED: Could not get any playable URL.`, error);
      throw error;
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