import { Song } from '@/types/player';

// Appel direct à l'API depuis le navigateur (bypass edge function pour éviter Cloudflare)
const QOBUZ_API_BASE = 'https://dabmusic.xyz/api';

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
    // Appel direct à l'API depuis le navigateur
    const response = await fetch(
      `${QOBUZ_API_BASE}/search?q=${encodeURIComponent(query)}&offset=0&type=track`,
      {
        method: 'GET',
        credentials: 'include', // Important pour les cookies de session si besoin
        headers: {
          'Accept': 'application/json',
        }
      }
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

        return {
          id: `qobuz-${item.id}`,
          title: item.title || 'Titre inconnu',
          artist: item.artist || 'Artiste inconnu',
          duration: formatDuration(item.duration), // duration est en secondes selon l'API
          url: `qobuz:${item.id}`,
          imageUrl: imageUrl,
          album_name: item.albumTitle || 'Album inconnu',
          genre: item.genre || undefined,
        };
      } catch (mapError) {
        console.error(`[QobuzService] Erreur lors du mappage de l'élément Qobuz:`, mapError);
        return null;
      }
    }).filter(Boolean);

    console.log(`[QobuzService] ${songs.length} pistes trouvées`);
    return songs;
  } catch (error) {
    console.error('Erreur lors de la recherche de pistes Qobuz:', error);
    return [];
  }
};

export const getQobuzStreamUrl = async (trackId: string): Promise<{ url: string } | null> => {
  if (!trackId) return null;

  try {
    // Appel direct à l'API depuis le navigateur
    const response = await fetch(
      `${QOBUZ_API_BASE}/stream?trackId=${trackId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
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
