import { supabase } from '@/integrations/supabase/client';
import { Song } from '@/types/player';

interface DeezerTrack {
  id: number;
  title: string;
  artist: { name: string };
  album: { cover_medium?: string; title?: string };
  duration: number;
}

interface DeezerGenreResponse {
  data: DeezerTrack[];
}

/**
 * Récupère des recommandations Deezer basées sur le genre de la chanson actuelle
 */
export async function getDeezerRecommendationsByGenre(
  currentSong: Song,
  limit: number = 10
): Promise<Song[]> {
  try {
    // Si la chanson a un deezer_id, on peut utiliser l'API Deezer
    if (currentSong.deezer_id) {
      console.log("🎵 Récupération recommandations Deezer pour:", currentSong.title);
      
      // Appeler l'edge function deezer-proxy pour obtenir les recommandations
      const { data, error } = await supabase.functions.invoke('deezer-proxy', {
        body: { 
          path: `/track/${currentSong.deezer_id}/radio`,
          limit: limit * 2 // Récupérer plus pour filtrer ensuite
        }
      });

      if (error) {
        console.error("❌ Erreur API Deezer:", error);
        return [];
      }

      if (!data || !data.data) {
        console.warn("⚠️ Pas de données Deezer");
        return [];
      }

      const tracks: DeezerTrack[] = data.data;
      
      // Convertir les tracks Deezer en Songs
      const recommendations: Song[] = tracks
        .slice(0, limit)
        .map((track: DeezerTrack) => ({
          id: `deezer-${track.id}`,
          title: track.title,
          artist: track.artist.name,
          url: `deezer:${track.id}`,
          imageUrl: track.album.cover_medium,
          duration: formatDuration(track.duration),
          deezer_id: track.id.toString(),
          isDeezer: true,
          genre: currentSong.genre, // Même genre que la chanson actuelle
          album_name: track.album.title
        }));

      console.log("✅ Recommandations Deezer:", recommendations.length, "chansons");
      return recommendations;
    }

    // Si pas de deezer_id, chercher par genre dans la base
    if (currentSong.genre) {
      console.log("🎵 Recherche par genre:", currentSong.genre);
      
      // Récupérer l'historique d'écoute pour exclure les chansons déjà écoutées
      const { data: historyData } = await supabase
        .from('play_history')
        .select('song_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
        .order('played_at', { ascending: false })
        .limit(200);

      const excludedIds = historyData?.map(h => h.song_id) || [];

      // Chercher des chansons du même genre
      let query = supabase
        .from('songs')
        .select('*')
        .eq('genre', currentSong.genre)
        .neq('id', currentSong.id);

      if (excludedIds.length > 0) {
        query = query.not('id', 'in', `(${excludedIds.join(',')})`);
      }

      const { data: genreSongs, error } = await query.limit(limit * 10);

      if (error) {
        console.error("❌ Erreur recherche genre:", error);
        return [];
      }

      if (!genreSongs || genreSongs.length === 0) {
        console.warn("⚠️ Pas de chansons du genre:", currentSong.genre);
        return [];
      }

      // Mélanger et limiter les résultats
      const shuffled = shuffleArray(genreSongs);
      return shuffled.slice(0, limit).map(song => ({
        ...song,
        url: song.file_path
      }));
    }

    console.warn("⚠️ Impossible de trouver des recommandations");
    return [];
  } catch (error) {
    console.error("❌ Erreur getDeezerRecommendationsByGenre:", error);
    return [];
  }
}

/**
 * Formate la durée en secondes vers format mm:ss
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Mélange un tableau (Fisher-Yates shuffle)
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
