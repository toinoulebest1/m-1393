import { Song } from '@/types/player';

const SEARCH_API_URL = 'https://frankfurt.monochrome.tf/search/?s=';
const STREAM_API_URL = 'https://tidal.kinoplus.online/track/';

// Helper pour formater la durée de secondes en MM:SS
const formatDuration = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Helper pour construire l'URL de l'image de l'album
const getImageUrl = (coverId: string, resolution: number = 320): string => {
    if (!coverId) return '/placeholder.svg';
    const formattedId = coverId.replace(/-/g, '/');
    return `https://images.tidal.com/images/${formattedId}/${resolution}x${resolution}.jpg`;
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

    const songs: Song[] = data.items.map((item: any) => ({
      id: `tidal-${item.id}`, // Préfixe pour éviter les collisions avec les chansons locales
      title: item.title,
      artist: item.artist?.name || (item.artists && item.artists[0]?.name) || 'Artiste inconnu',
      duration: formatDuration(item.duration),
      url: `tidal:${item.id}`, // Schéma d'URL personnalisé pour identifier les pistes Tidal
      imageUrl: getImageUrl(item.album?.cover),
      album_name: item.album?.title,
      tidal_id: item.id.toString(),
      isDeezer: true, // Marqueur pour indiquer une piste externe
    }));

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
    if (!response.ok) {
      throw new Error(`La récupération du flux Tidal a échoué: ${response.status}`);
    }
    const data = await response.json();

    if (data && data.OriginalTrackUrl) {
      return { url: data.OriginalTrackUrl };
    }

    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'URL du flux Tidal:', error);
    return null;
  }
};