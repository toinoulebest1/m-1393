import { Song } from '@/types/player';
import { supabase } from '@/integrations/supabase/client';

const IMAGE_PROXY_URL = 'https://pwknncursthenghqgevl.supabase.co/functions/v1/image-proxy?src=';
const TIDAL_API_FUNCTION = 'https://pwknncursthenghqgevl.supabase.co/functions/v1/tidal-api';

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
  console.log(`[TidalService] Searching for: "${query}"`);

  try {
    const response = await fetch(TIDAL_API_FUNCTION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'search',
        query: query
      })
    });

    console.log(`[TidalService] Search API response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`La recherche Tidal a échoué: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[TidalService] Raw search data received:', data);

    if (!data.tracks || data.tracks.length === 0) {
      console.log('[TidalService] No tracks found in search response.');
      return [];
    }

    const songs: Song[] = data.tracks.map((track: any) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      duration: formatDuration(track.duration),
      url: `tidal:${track.tidal_id}`,
      imageUrl: track.image_url ? `${IMAGE_PROXY_URL}${encodeURIComponent(track.image_url)}` : '/placeholder.svg',
      album_name: track.album_name,
      tidal_id: track.tidal_id,
    }));

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
    const response = await fetch(TIDAL_API_FUNCTION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'stream',
        trackId: trackId,
        quality: 'HIGH'
      })
    });

    console.log(`[TidalService] Stream API response status: ${response.status}`);
    
    const responseBody = await response.text();
    
    if (!response.ok) {
      console.error(`[TidalService] Stream API error response body:`, responseBody);
      throw new Error(`La récupération du flux Tidal a échoué: ${response.status}`);
    }

    const data = JSON.parse(responseBody);
    console.log('[TidalService] Stream data received:', data);

    if (data && data.url) {
      console.log(`[TidalService] Found stream URL: ${data.url}`);
      return { url: data.url };
    }

    console.warn('[TidalService] URL not found in stream response. Full response:', data);
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'URL du flux Tidal:', error);
    return null;
  }
};