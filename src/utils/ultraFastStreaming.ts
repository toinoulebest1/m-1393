import { getAudioFileUrl } from '@/utils/storage';
import { getTidalStreamUrl } from '@/services/tidalService';
import { getFromCache, addToCache, cacheCurrentSong } from './audioCache';
import { UltraFastCache } from './ultraFastCache';
// import { memoryCache } from './memoryCache'; // DÉSACTIVÉ

export class UltraFastStreaming {
  /**
   * Récupère l'URL de streaming audio la plus rapide possible.
   * Priorise le cache L0, puis le cache IndexedDB, puis le pré-warm, puis le réseau.
   */
  static async getAudioUrlUltraFast(
    filePath: string,
    songTitle?: string,
    songArtist?: string,
    songId?: string
  ): Promise<{ url: string; duration?: number }> {
    const logPrefix = `[UltraFastStreaming] ${songTitle || 'N/A'} |`;
    const isTidal = filePath.startsWith('tidal:');
    const isHttp = filePath.startsWith('http://') || filePath.startsWith('https://');

    // 1. Vérifier le cache L0 (variables globales)
    if (songId && UltraFastCache.hasL0(songId)) {
      // console.log(`${logPrefix} HIT L0 Cache`);
      return { url: UltraFastCache.getL0(songId)! };
    }

    // 2. Vérifier le cache IndexedDB
    if (songId) {
      const cachedBlobUrl = await getFromCache(songId);
      if (cachedBlobUrl) {
        // console.log(`${logPrefix} HIT IndexedDB Cache`);
        // Ajouter au cache L0 pour les prochaines fois
        // UltraFastCache.setL0(songId, cachedBlobUrl, new Blob()); // Blob vide car déjà en mémoire
        return { url: cachedBlobUrl };
      }
    }

    // 3. Vérifier le cache "warm" (URLs pré-calculées)
    if (songId && UltraFastCache.getWarm(songId)) {
      // console.log(`${logPrefix} HIT Warm Cache`);
      return { url: UltraFastCache.getWarm(songId)! };
    }

    // 4. Récupérer l'URL distante
    let remoteStream: { url: string; duration?: number } | null = null;
    try {
      if (isTidal) {
        const tidalId = filePath.split(':')[1];
        // console.log(`${logPrefix} STEP 2: Getting Tidal stream URL via proxy...`);
        // console.log(`${logPrefix} INFO: Extracted Tidal ID: ${tidalId}`);
        // Obtenir l'URL directe de Tidal via le service, puis la passer au proxy
        const directTidalUrlResult = await getTidalStreamUrl(tidalId);
        // console.log(`${logPrefix} INFO: Result from getTidalStreamUrl:`, directTidalUrlResult);

        if (!directTidalUrlResult || !directTidalUrlResult.url) {
          throw new Error("Impossible d'obtenir l'URL directe de Tidal.");
        }
        // Construire l'URL du proxy Edge Function
        const proxyUrl = `https://pwknncursthenghqgevl.supabase.co/functions/v1/audio-proxy?src=${encodeURIComponent(directTidalUrlResult.url)}`;
        // console.log(`${logPrefix} INFO: Constructed proxy URL: ${proxyUrl.substring(0, 100)}...`);
        remoteStream = { url: proxyUrl }; // Le proxy gérera le transcodage si nécessaire
      } else if (isHttp) {
        // console.log(`${logPrefix} STEP 2: Path is a direct HTTP URL.`);
        remoteStream = { url: filePath };
      } else {
        // console.log(`${logPrefix} STEP 2: Getting Supabase/local file URL...`);
        remoteStream = await getAudioFileUrl(filePath, songTitle, songArtist, songId);
      }

      if (!remoteStream || !remoteStream.url) {
        throw new Error("Impossible d'obtenir une URL de streaming distante.");
      }

      // console.log(`${logPrefix} SUCCESS: Got remote URL for instant playback: ${remoteStream.url.substring(0, 100)}...`);

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
   * Met en cache l'audio en arrière-plan.
   * Télécharge le fichier et le stocke dans IndexedDB et le cache L0.
   */
  static async backgroundCache(
    originalFilePath: string,
    audioUrl: string,
    songId?: string,
    songTitle?: string
  ): Promise<void> {
    const logPrefix = `[UltraFastStreaming.backgroundCache] ${songTitle || 'N/A'} |`;
    if (!songId) {
      // console.log(`${logPrefix} Skipping background cache: no songId provided.`);
      return;
    }

    try {
      // console.log(`${logPrefix} Starting background caching for: ${audioUrl.substring(0, 100)}...`);
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Erreur de téléchargement: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();

      // Ajouter au cache IndexedDB
      await addToCache(songId, blob);
      // console.log(`${logPrefix} Added to IndexedDB cache.`);

      // Ajouter au cache L0
      const blobUrl = URL.createObjectURL(blob);
      UltraFastCache.setL0(songId, blobUrl, blob);
      // console.log(`${logPrefix} Added to L0 cache.`);

      // Mettre à jour le cache de la chanson actuelle (pour les 2 dernières chansons)
      await cacheCurrentSong(songId, blob, songId, songTitle);
      // console.log(`${logPrefix} Updated current song cache.`);

    } catch (error) {
      console.warn(`${logPrefix} Failed background caching:`, error);
    }
  }
}