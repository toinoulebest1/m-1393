import { Song } from '@/types/player';

const SEARCH_API_URL = 'https://tidal.kinoplus.online/search/?s=';
const STREAM_API_URL = 'https://tidal.kinoplus.online/track/';
const IMAGE_PROXY_URL = 'https://pwknncursthenghqgevl.supabase.co/functions/v1/image-proxy?src=';

// Helper pour formater la durée de secondes en MM:SS
const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00'; // Gérer les secondes négatives ou NaN
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Helper pour construire l'URL de l'image de l'album
const getImageUrl = (coverId: string, resolution: number = 1280): string => {
    if (!coverId) return '/placeholder.svg';
    const formattedId = coverId.replace(/-/g, '/');
    const directTidalImageUrl = `https://resources.tidal.com/images/${formattedId}/${resolution}x${resolution}.jpg`;
    return `${IMAGE_PROXY_URL}${encodeURIComponent(directTidalImageUrl)}`; // Utiliser le proxy
}

export const searchTidalTracks = async (query: string): Promise<Song[]> => {
  if (!query) return [];

  try {
    const response = await fetch(`${SEARCH_API_URL}${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`La recherche Tidal a échoué: ${response.status}`);
    }
    
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return [];
    }

    const songs: Song[] = data.items.map((item: any) => {
      try {
        if (!item.id) {
          console.warn(`[TidalService] Item skipped due to missing ID:`, item);
          return null;
        }

        const artistName = item.artist?.name || (item.artists && item.artists[0]?.name) || 'Artiste inconnu';
        const albumTitle = item.album?.title || 'Album inconnu';
        const imageUrl = getImageUrl(item.album?.cover || '');

        return {
          id: `tidal-${item.id}`,
          title: item.title || 'Titre inconnu',
          artist: artistName,
          duration: formatDuration(item.duration),
          url: `tidal:${item.id}`,
          imageUrl: imageUrl,
          album_name: albumTitle,
          tidal_id: item.id.toString(),
        };
      } catch (mapError) {
        console.error(`[TidalService] Erreur lors du mappage de l'élément Tidal:`, mapError);
        return null;
      }
    }).filter(Boolean);

    return songs;
  } catch (error) {
    console.error('Erreur lors de la recherche de pistes Tidal:', error);
    return [];
  }
};

export const getTidalStreamUrl = async (trackId: string): Promise<{ url: string } | null> => {
  if (!trackId) return null;

  try {
    const response = await fetch(`${STREAM_API_URL}?id=${trackId}&quality=LOSSLESS`);
    
    const responseBody = await response.text();
    
    if (!response.ok) {
      throw new Error(`La récupération du flux Tidal a échoué: ${response.status}`);
    }

    const data = JSON.parse(responseBody);

    if (Array.isArray(data)) {
      const streamInfo = data.find(item => item && typeof item === 'object' && 'OriginalTrackUrl' in item);
      if (streamInfo && streamInfo.OriginalTrackUrl) {
        return { url: streamInfo.OriginalTrackUrl };
      }
    } else if (data && data.OriginalTrackUrl) {
      return { url: data.OriginalTrackUrl };
    }

    console.warn('[TidalService] OriginalTrackUrl not found in stream response.');
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'URL du flux Tidal:', error);
    return null;
  }
};