import { Song } from '@/types/player';

const SEARCH_API_URL = 'https://tidal.kinoplus.online/search/?s=';
const STREAM_API_URL = 'https://tidal.kinoplus.online/track/';

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
    return `https://resources.tidal.com/images/${formattedId}/${resolution}x${resolution}.jpg`;
}

export const searchTidalTracks = async (query: string): Promise<Song[]> => {
  if (!query) return [];
  console.log(`[TidalService] Searching for: "${query}"`);

  try {
    const response = await fetch(`${SEARCH_API_URL}${encodeURIComponent(query)}`);
    console.log(`[TidalService] Search API response status: ${response.status}`);
    if (!response.ok) {
      throw new Error(`La recherche Tidal a échoué: ${response.status}`);
    }
    const data = await response.json();
    console.log('[TidalService] Raw search data received:', data);

    if (!data.items || data.items.length === 0) {
      console.log('[TidalService] No items found in search response.');
      return [];
    }

    const songs: Song[] = data.items.map((item: any) => {
      try {
        // Vérifier si l'ID est présent et valide
        if (!item.id) {
          console.warn(`[TidalService] Item skipped due to missing ID:`, item);
          return null; // Skip this item
        }

        const artistName = item.artist?.name || (item.artists && item.artists[0]?.name) || 'Artiste inconnu';
        const albumTitle = item.album?.title || 'Album inconnu';
        const imageUrl = getImageUrl(item.album?.cover || '');

        console.log(`[TidalService] Mapping item: ID=${item.id}, Title=${item.title}, Artist=${artistName}, Album=${albumTitle}, Image=${imageUrl}`);

        return {
          id: `tidal-${item.id}`, // Préfixe pour éviter les collisions avec les chansons locales
          title: item.title || 'Titre inconnu',
          artist: artistName,
          duration: formatDuration(item.duration),
          url: `tidal:${item.id}`, // Schéma d'URL personnalisé pour identifier les pistes Tidal
          imageUrl: imageUrl,
          album_name: albumTitle,
          tidal_id: item.id.toString(),
        };
      } catch (mapError) {
        console.error(`[TidalService] Erreur lors du mappage de l'élément Tidal (ID: ${item?.id || 'inconnu'}):`, mapError, 'Item:', item);
        return null; // Retourne null pour cet élément en cas d'erreur
      }
    }).filter(Boolean); // Filtre les éléments null (ceux qui ont échoué au mappage)

    console.log(`[TidalService] Mapped ${songs.length} songs from search results.`);
    return songs;
  } catch (error) {
    console.error('Erreur lors de la recherche de pistes Tidal:', error);
    return [];
  }
};

export const getTidalStreamUrl = async (trackId: string): Promise<{ url: string } | null> => {
  if (!trackId) return null;
  console.log(`[TidalService] Getting stream URL for trackId: ${trackId}`);

  try {
    const response = await fetch(`${STREAM_API_URL}?id=${trackId}&quality=LOSSLESS`);
    console.log(`[TidalService] Stream API response status: ${response.status}`);
    
    const responseBody = await response.text(); // Lire la réponse en texte brut d'abord
    
    if (!response.ok) {
      console.error(`[TidalService] Stream API error response body:`, responseBody);
      throw new Error(`La récupération du flux Tidal a échoué: ${response.status}`);
    }

    const data = JSON.parse(responseBody); // Essayer de parser le JSON
    console.log('[TidalService] Raw stream data received:', data);

    // Gère le nouveau format de réponse (tableau) et l'ancien (objet)
    if (Array.isArray(data)) {
      const streamInfo = data.find(item => item && typeof item === 'object' && 'OriginalTrackUrl' in item);
      if (streamInfo && streamInfo.OriginalTrackUrl) {
        console.log(`[TidalService] Found stream URL in array: ${streamInfo.OriginalTrackUrl}`);
        return { url: streamInfo.OriginalTrackUrl };
      }
    } else if (data && data.OriginalTrackUrl) {
      console.log(`[TidalService] Found stream URL in object: ${data.OriginalTrackUrl}`);
      return { url: data.OriginalTrackUrl };
    }

    console.warn('[TidalService] OriginalTrackUrl not found in stream response. Full response:', data);
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'URL du flux Tidal:', error);
    return null;
  }
};