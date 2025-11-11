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
    console.log(`${logPrefix} Starting to fetch audio URL...`);
    console.log(`${logPrefix}   - File Path: ${filePath}`);
    console.log(`${logPrefix}   - Song ID: ${songId}`);

    const isTidal = filePath.startsWith('tidal:');
    const isHttp = filePath.startsWith('http://') || filePath.startsWith('https://');

    // 1. Vérifier le cache L0 (variables globales)
    if (songId && UltraFastCache.hasL0(songId)) {
      const cachedUrl = UltraFastCache.getL0(songId)!;
      console.log(`${logPrefix} HIT L0 Cache`);
      console.log(`${logPrefix}   - Cached URL: ${cachedUrl}`);
      return { url: cachedUrl };
    }

    // 2. Vérifier le cache IndexedDB
    if (songId) {
      const cachedBlobUrl = await getFromCache(songId);
      if (cachedBlobUrl) {
        console.log(`${logPrefix} HIT IndexedDB Cache`);
        console.log(`${logPrefix}   - Cached Blob URL: ${cachedBlobUrl}`);
        // UltraFastCache.setL0(songId, cachedBlobUrl, new Blob()); // Blob vide car déjà en mémoire
        return { url: cachedBlobUrl };
      }
    }

    // 3. Vérifier le cache "warm" (URLs pré-calculées)
    if (songId && UltraFastCache.getWarm(songId)) {
      const warmUrl = UltraFastCache.getWarm(songId)!;
      console.log(`${logPrefix} HIT Warm Cache`);
      console.log(`${logPrefix}   - Warm URL: ${warmUrl}`);
      return { url: warmUrl };
    }

    // 4. Récupérer l'URL distante
    console.log(`${logPrefix} No cache hit, fetching remote URL...`);
    let remoteStream: { url: string; duration?: number } | null = null;
    try {
      if (isTidal) {
        const tidalId = filePath.split(':')[1];
        console.log(`${logPrefix} STEP 2: Getting Tidal stream URL via proxy...`);
        console.log(`${logPrefix} INFO: Extracted Tidal ID: ${tidalId}`);
        const directTidalUrlResult = await getTidalStreamUrl(tidalId);
        console.log(`${logPrefix} INFO: Result from getTidalStreamUrl:`, directTidalUrlResult);

        if (!directTidalUrlResult || !directTidalUrlResult.url) {
          throw new Error("Impossible d'obtenir l'URL directe de Tidal.");
        }
        const proxyUrl = `https://pwknncursthenghqgevl.supabase.co/functions/v1/audio-proxy?src=${encodeURIComponent(directTidalUrlResult.url)}`;
        console.log(`${logPrefix} INFO: Constructed proxy URL: ${proxyUrl.substring(0, 100)}...`);
        remoteStream = { url: proxyUrl };
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

      this.backgroundCache(filePath, remoteStream.url, songId, songTitle);

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
      return;
    }

    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Erreur de téléchargement: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();

      await addToCache(songId, blob);

      const blobUrl = URL.createObjectURL(blob);
      UltraFastCache.setL0(songId, blobUrl, blob);

      await cacheCurrentSong(songId, blob, songId, songTitle);

    } catch (error) {
      console.warn(`${logPrefix} Failed background caching:`, error);
    }
  }
}