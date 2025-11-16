import { Song } from '@/types/player';

const SUPABASE_URL = 'https://pwknncursthenghqgevl.supabase.co';
const QOBUZ_PROXY_URL = `${SUPABASE_URL}/functions/v1/qobuz-proxy`;
const QOBUZ_STREAM_URL = `${SUPABASE_URL}/functions/v1/qobuz-stream`;
const QOBUZ_STREAM_BATCH_URL = `${SUPABASE_URL}/functions/v1/qobuz-stream-batch`;

// Helper pour formater la durée de secondes en MM:SS
const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const searchQobuzTracks = async (query: string): Promise<Song[]> => {
  if (!query) return [];

  try {
    const response = await fetch(
      `${QOBUZ_PROXY_URL}?endpoint=search&q=${encodeURIComponent(query)}&limit=100&offset=0&type=track`
    );
    
    if (!response.ok) {
      throw new Error(`La recherche Qobuz a échoué: ${response.status}`);
    }
    
    const data = await response.json();

    // L'API dabmusic.xyz retourne { tracks: [...], albums: [...], artists: [...], pagination: {...} }
    if (!data.tracks || data.tracks.length === 0) {
      console.warn('[QobuzService] Aucun résultat trouvé dans data.tracks');
      return [];
    }

    const songs: Song[] = data.tracks.map((item: any) => {
      try {
        if (!item.id) {
          console.warn(`[QobuzService] Item skipped due to missing ID:`, item);
          return null;
        }

        // Mapping selon le schéma OpenAPI: albumCover pour l'image
        const imageUrl = item.albumCover || '/placeholder.svg';

        // Détection Hi-Res: Qobuz fournit maximum_bit_depth et maximum_sampling_rate
        const bitDepth = item.maximum_bit_depth || item.bit_depth;
        const samplingRate = item.maximum_sampling_rate || item.sampling_rate;
        const isHiRes = (bitDepth >= 24) || (samplingRate >= 88200);

        return {
          id: `qobuz-${item.id}`,
          title: item.title || 'Titre inconnu',
          artist: item.artist || 'Artiste inconnu',
          duration: formatDuration(item.duration), // duration est en secondes selon l'API
          url: `qobuz:${item.id}`,
          imageUrl: imageUrl,
          album_name: item.albumTitle || 'Album inconnu',
          genre: item.genre || undefined,
          audioQuality: bitDepth || samplingRate ? {
            bitDepth,
            samplingRate,
            isHiRes
          } : undefined,
        };
      } catch (mapError) {
        console.error(`[QobuzService] Erreur lors du mappage de l'élément Qobuz:`, mapError);
        return null;
      }
    }).filter(Boolean);

    console.log(`[QobuzService] ${songs.length} pistes trouvées`);
    
    // Précharger immédiatement les URLs des 5 premières chansons
    const topTrackIds = songs.slice(0, 5).map(song => {
      const match = song.url.match(/^qobuz:(.+)$/);
      return match ? match[1] : null;
    }).filter(Boolean) as string[];
    
    if (topTrackIds.length > 0) {
      // Fire and forget - ne pas attendre
      preloadQobuzUrls(topTrackIds).catch(err => 
        console.warn('[QobuzService] Préchargement background échoué:', err)
      );
    }
    
    return songs;
  } catch (error) {
    console.error('Erreur lors de la recherche de pistes Qobuz:', error);
    return [];
  }
};

// Cache mémoire pour les URLs Qobuz (TTL: 50 minutes)
const urlCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 50 * 60 * 1000; // 50 minutes
// Déduplication des requêtes en cours (évite doubles appels au clic)
const pendingRequests = new Map<string, Promise<{ url: string } | null>>();

const getCachedUrl = (trackId: string): string | null => {
  const cached = urlCache.get(trackId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.url;
  }
  if (cached) {
    urlCache.delete(trackId);
  }
  return null;
};

const setCachedUrl = (trackId: string, url: string) => {
  urlCache.set(trackId, { url, timestamp: Date.now() });
};

export const getQobuzStreamUrl = async (trackId: string): Promise<{ url: string } | null> => {
  if (!trackId) return null;

  // 1) Cache mémoire durable
  const cachedUrl = getCachedUrl(trackId);
  if (cachedUrl) {
    console.log(`[QobuzService] Cache HIT for track ${trackId}`);
    return { url: cachedUrl };
  }

  // 2) Requête déjà en cours ? Réutiliser la même promesse
  const inFlight = pendingRequests.get(trackId);
  if (inFlight) {
    console.log(`[QobuzService] Pending request reused for ${trackId}`);
    return inFlight;
  }

  // 3) Lancer la requête et la stocker
  const promise = (async () => {
    try {
      const response = await fetch(`${QOBUZ_STREAM_URL}?track_id=${trackId}`);
      if (!response.ok) throw new Error(`Qobuz stream request failed: ${response.status}`);
      const data = await response.json();
      if (!data.url) throw new Error('No URL in Qobuz stream response');
      setCachedUrl(trackId, data.url);
      console.log(`[QobuzService] Got direct CDN URL for track ${trackId}`);
      return { url: data.url };
    } catch (error) {
      console.error('Erreur lors de la génération de l\'URL du flux Qobuz:', error);
      return null;
    } finally {
      pendingRequests.delete(trackId);
    }
  })();

  pendingRequests.set(trackId, promise);
  return promise;
};

// Préchargement batch des URLs pour démarrage instantané - ULTRA RAPIDE
export const preloadQobuzUrls = async (trackIds: string[]): Promise<void> => {
  if (trackIds.length === 0) return;
  
  console.log(`[QobuzService] Préchargement BATCH de ${trackIds.length} URLs en 1 appel...`);
  
  try {
    const response = await fetch(QOBUZ_STREAM_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_ids: trackIds })
    });
    
    if (!response.ok) {
      throw new Error(`Batch request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Mettre tous les résultats en cache immédiatement
    data.results.forEach((result: any) => {
      if (result.url) {
        setCachedUrl(result.trackId, result.url);
      }
    });
    
    console.log(`[QobuzService] ✅ Batch préchargement terminé: ${data.success_count}/${data.total}`);
  } catch (error) {
    console.warn('[QobuzService] Batch préchargement échoué:', error);
  }
};
