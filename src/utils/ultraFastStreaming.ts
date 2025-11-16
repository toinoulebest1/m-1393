import { getAudioFileUrl } from '@/utils/storage';
import { getMusicStreamUrl, detectProviderFromUrl } from '@/services/musicService';
import { getFromCache, addToCache, cacheCurrentSong } from './audioCache';
import { UltraFastCache } from './ultraFastCache';

export class UltraFastStreaming {
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
    const isQobuz = filePath.startsWith('qobuz:');
    const isMusicApi = isTidal || isQobuz;
    const isHttp = filePath.startsWith('http://') || filePath.startsWith('https://');

    // 1. Vérifier le cache L0
    if (songId && UltraFastCache.hasL0(songId)) {
      const cachedUrl = UltraFastCache.getL0(songId)!;
      console.log(`${logPrefix} HIT L0 Cache`);
      return { url: cachedUrl };
    }

    // 2. Vérifier le cache IndexedDB
    if (songId) {
      const cachedBlobUrl = await getFromCache(songId);
      if (cachedBlobUrl) {
        console.log(`${logPrefix} HIT IndexedDB Cache`);
        return { url: cachedBlobUrl };
      }
    }

    // 3. Vérifier le cache "warm"
    if (songId && UltraFastCache.getWarm(songId)) {
      const warmUrl = UltraFastCache.getWarm(songId)!;
      console.log(`${logPrefix} HIT Warm Cache`);
      return { url: warmUrl };
    }

    // 4. Récupérer l'URL distante
    console.log(`${logPrefix} No cache hit, fetching remote URL...`);
    let remoteStream: { url: string; duration?: number } | null = null;
    try {
      if (isMusicApi) {
        const provider = detectProviderFromUrl(filePath);
        const trackId = filePath.split(':')[1];
        console.log(`${logPrefix} STEP 2: Getting ${provider?.toUpperCase()} stream URL...`);
        const streamUrlResult = await getMusicStreamUrl(trackId, provider || 'tidal');

        if (!streamUrlResult || !streamUrlResult.url) {
          throw new Error(`Impossible d'obtenir l'URL de ${provider?.toUpperCase()}.`);
        }
        
        // Qobuz utilise directement qobuz-stream (pas d'audio-proxy)
        if (isQobuz) {
          console.log(`${logPrefix} Using direct qobuz-stream`);
          remoteStream = { url: streamUrlResult.url };
        } else {
          // Tidal utilise audio-proxy
          const proxyUrl = `https://pwknncursthenghqgevl.supabase.co/functions/v1/audio-proxy?src=${encodeURIComponent(streamUrlResult.url)}`;
          remoteStream = { url: proxyUrl };
        }
      } else if (isHttp) {
        remoteStream = { url: filePath };
      } else {
        remoteStream = await getAudioFileUrl(filePath, songTitle, songArtist, songId);
      }

      if (!remoteStream || !remoteStream.url) {
        throw new Error("Impossible d'obtenir une URL de streaming.");
      }

      console.log(`${logPrefix} SUCCESS: Got remote URL`);
      this.backgroundCache(filePath, remoteStream.url, songId, songTitle);
      return remoteStream;

    } catch (error) {
      console.error(`${logPrefix} ERROR:`, error);
      throw error;
    }
  }

  static async backgroundCache(
    originalFilePath: string,
    audioUrl: string,
    songId?: string,
    songTitle?: string
  ): Promise<void> {
    const logPrefix = `[UltraFastStreaming.backgroundCache] ${songTitle || 'N/A'} |`;
    if (!songId) return;

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
