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

/**
 * Récupère un mix de chansons locales et Deezer pour les jeux
 */
export const fetchGameSongs = async (minSongs: number = 20): Promise<GameSong[]> => {
  try {
    // 1. Récupérer les chansons locales
    const { data: localSongs, error: localError } = await supabase
      .from("songs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (localError) {
      console.error("Error fetching local songs:", localError);
    }

    const formattedLocalSongs: GameSong[] = (localSongs || []).map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist || '',
      url: song.file_path,
      imageUrl: song.image_url,
      duration: song.duration || '0:00',
      isDeezer: false
    }));

    // 2. Si on n'a pas assez de chansons locales, récupérer des tracks Deezer
    if (formattedLocalSongs.length < minSongs) {
      console.log('🎵 Pas assez de chansons locales, récupération de tracks Deezer...');
      
      const { data: deezerData, error: deezerError } = await supabase.functions.invoke('deezer-search', {
        body: { 
          query: 'top tracks 2024',
          limit: Math.max(30, minSongs - formattedLocalSongs.length)
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

        console.log(`✅ ${deezerTracks.length} tracks Deezer récupérées`);
        return [...formattedLocalSongs, ...deezerTracks];
      }
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
