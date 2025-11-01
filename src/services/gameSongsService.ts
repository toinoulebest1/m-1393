import { supabase } from '@/integrations/supabase/client';

export interface GameSong {
  id: string;
  title: string;
  artist: string;
  url: string;
  imageUrl?: string;
  duration: string;
  isDeezer?: boolean;
}

// Différentes requêtes Deezer pour varier les musiques
const deezerQueries = [
  'top hits 2024',
  'pop music',
  'rock classics',
  'hip hop',
  'electronic music',
  'french music',
  'indie music',
  'r&b soul',
  'latino hits',
  'jazz standards',
  'country music',
  'reggae',
  'top 50 france',
  'rap français',
  'dance music'
];

/**
 * Récupère un mix de chansons locales et Deezer pour les jeux
 */
export const fetchGameSongs = async (minSongs: number = 20): Promise<GameSong[]> => {
  try {
    // 1. Récupérer TOUTES les chansons locales pour pouvoir les mélanger
    const { data: localSongs, error: localError } = await supabase
      .from("songs")
      .select("*");

    if (localError) {
      console.error("Error fetching local songs:", localError);
    }

    // Mélanger aléatoirement les chansons locales
    const shuffledLocalSongs = (localSongs || []).sort(() => Math.random() - 0.5);
    
    const formattedLocalSongs: GameSong[] = shuffledLocalSongs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist || '',
      url: song.file_path,
      imageUrl: song.image_url,
      duration: song.duration || '0:00',
      isDeezer: false
    }));

    // 2. Toujours récupérer des tracks Deezer pour plus de variété
    console.log('🎵 Récupération de tracks Deezer pour varier les musiques...');
    
    // Sélectionner aléatoirement une requête Deezer
    const randomQuery = deezerQueries[Math.floor(Math.random() * deezerQueries.length)];
    
    const { data: deezerData, error: deezerError } = await supabase.functions.invoke('deezer-search', {
      body: { 
        query: randomQuery,
        limit: Math.max(30, minSongs)
      }
    });

    if (!deezerError && deezerData?.data) {
      const deezerTracks: GameSong[] = deezerData.data.map((track: any) => ({
        id: `deezer-${track.id}`,
        title: track.title,
        artist: track.artist?.name || '',
        url: track.preview || '',
        imageUrl: track.album?.cover_medium || track.album?.cover_big,
        duration: track.duration ? formatDuration(track.duration) : '0:30',
        isDeezer: true
      })).filter((track: GameSong) => track.url); // Filtrer les tracks sans preview

      console.log(`✅ ${deezerTracks.length} tracks Deezer récupérées (query: "${randomQuery}")`);
      
      // Mélanger les chansons locales et Deezer ensemble
      const allSongs = [...formattedLocalSongs, ...deezerTracks];
      return allSongs.sort(() => Math.random() - 0.5);
    }

    return formattedLocalSongs;
  } catch (error) {
    console.error("Exception while fetching game songs:", error);
    return [];
  }
};

/**
 * Formate la durée en secondes vers mm:ss
 */
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
