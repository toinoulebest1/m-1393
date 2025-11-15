import { Song } from '@/types/player';

const SEARCH_API_URL = 'https://dab.yeet.su/api/search';
const STREAM_API_URL = 'https://dab.yeet.su/api/stream';

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
    const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(query)}&offset=0&type=track`);
    
    if (!response.ok) {
      throw new Error(`La recherche Qobuz a échoué: ${response.status}`);
    }
    
    const data = await response.json();

    if (!data.tracks || data.tracks.length === 0) {
      return [];
    }

    const songs: Song[] = data.tracks.map((item: any) => {
      try {
        if (!item.id) {
          console.warn(`[QobuzService] Item skipped due to missing ID:`, item);
          return null;
        }

        const imageUrl = item.images?.large || item.albumCover || '/placeholder.svg';

        return {
          id: `qobuz-${item.id}`,
          title: item.title || 'Titre inconnu',
          artist: item.artist || 'Artiste inconnu',
          duration: formatDuration(item.duration),
          url: `qobuz:${item.id}`,
          imageUrl: imageUrl,
          album_name: item.albumTitle || 'Album inconnu',
          genre: item.genre || undefined,
          deezer_id: item.id.toString(),
        };
      } catch (mapError) {
        console.error(`[QobuzService] Erreur lors du mappage de l'élément Qobuz:`, mapError);
        return null;
      }
    }).filter(Boolean);

    return songs;
  } catch (error) {
    console.error('Erreur lors de la recherche de pistes Qobuz:', error);
    return [];
  }
};

export const getQobuzStreamUrl = async (trackId: string): Promise<{ url: string } | null> => {
  if (!trackId) return null;

  try {
    const response = await fetch(`${STREAM_API_URL}?trackId=${trackId}`);
    
    if (!response.ok) {
      throw new Error(`La récupération du flux Qobuz a échoué: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.url) {
      return { url: data.url };
    }

    console.warn('[QobuzService] URL not found in stream response.');
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'URL du flux Qobuz:', error);
    return null;
  }
};
