import { supabase } from '@/integrations/supabase/client';
import { Song } from '@/types/player';

interface DeezerTrack {
  id: number;
  title: string;
  artist: { name: string; id?: number };
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
    // Déterminer ou trouver le deezer_id et le genre via Deezer si nécessaire
    let deezerId = currentSong.deezer_id;
    let usedGenre = currentSong.genre;

    if (!deezerId && (currentSong.title || currentSong.artist)) {
      console.log("🔎 Recherche Deezer du track (pas de deezer_id)...");
      const q = [currentSong.title, currentSong.artist].filter(Boolean).join(" ");
      const { data: searchData, error: searchError } = await supabase.functions.invoke('deezer-proxy', {
        body: { path: `/search/track`, query: q, limit: 1 }
      });
      if (searchError) { console.error("❌ Erreur recherche Deezer:", searchError); }
      const found = searchData?.data?.[0] as DeezerTrack | undefined;
      if (found?.id) {
        deezerId = String(found.id);
        // Essayer de récupérer le genre de l'artiste
        const artistId = (found as any)?.artist?.id as number | undefined;
        if (!usedGenre && artistId) {
          try {
            const { data: artistGenres } = await supabase.functions.invoke('deezer-proxy', {
              body: { path: `/artist/${artistId}/genres`, limit: 1 }
            });
            const genreName = artistGenres?.data?.[0]?.name as string | undefined;
            if (genreName) usedGenre = genreName;
          } catch (e) {
            console.warn("⚠️ Impossible de récupérer le genre de l'artiste Deezer", e);
          }
        }
      }
    }

    // Si on a un deezerId (natif ou trouvé), utiliser l'API related pour recommandations
    if (deezerId) {
      console.log("🎵 Récupération artistes similaires Deezer pour:", currentSong.title || deezerId);
      
      const { data, error } = await supabase.functions.invoke('deezer-proxy', {
        body: { 
          path: `/track/${deezerId}/related`,
          limit: limit * 2 // Récupérer plus pour filtrer ensuite
        }
      });

      if (error) {
        console.error("❌ Erreur API Deezer:", error);
        // On tombera sur la recherche par genre DB plus bas
      } else if (data?.data) {
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
            genre: usedGenre || currentSong.genre,
            album_name: track.album.title
          }));

        if (recommendations.length > 0) {
          console.log("✅ Recommandations Deezer:", recommendations.length, "chansons");
          return recommendations;
        }
      }
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
