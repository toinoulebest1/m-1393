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
  limit: number = 10,
  recentHistory: Song[] = []
): Promise<Song[]> {
  try {
    // Déterminer ou trouver le deezer_id et le genre via Deezer si nécessaire
    let deezerId = currentSong.deezer_id;
    let usedGenre = currentSong.genre;
    let foundArtistId: number | undefined;

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
        foundArtistId = (found as any)?.artist?.id as number | undefined;
        // Essayer de récupérer le genre de l'artiste
        if (!usedGenre && foundArtistId) {
          try {
            const { data: artistGenres } = await supabase.functions.invoke('deezer-proxy', {
              body: { path: `/artist/${foundArtistId}/genres`, limit: 1 }
            });
            const genreName = artistGenres?.data?.[0]?.name as string | undefined;
            if (genreName) usedGenre = genreName;
          } catch (e) {
            console.warn("⚠️ Impossible de récupérer le genre de l'artiste Deezer", e);
          }
        }
      }

      // Fallback: si aucun artistId fiable trouvé via le track, rechercher l'artiste directement
      if (!foundArtistId && currentSong.artist) {
        console.log("🔎 Recherche Deezer de l'artiste (fallback)...", currentSong.artist);
        try {
          const { data: artistSearch } = await supabase.functions.invoke('deezer-proxy', {
            body: { path: `/search/artist`, query: currentSong.artist, limit: 1 }
          });
          const artistFound = (artistSearch as any)?.data?.[0];
          if (artistFound?.id) {
            foundArtistId = artistFound.id as number;
            console.log("✅ Artiste trouvé via recherche directe:", artistFound.name, foundArtistId);
            if (!usedGenre) {
              try {
                const { data: artistGenres2 } = await supabase.functions.invoke('deezer-proxy', {
                  body: { path: `/artist/${foundArtistId}/genres`, limit: 1 }
                });
                const genreName2 = (artistGenres2 as any)?.data?.[0]?.name as string | undefined;
                if (genreName2) usedGenre = genreName2;
              } catch (e) {
                console.warn("⚠️ Impossible de récupérer le genre (fallback artiste)", e);
              }
            }
          }
        } catch (e) {
          console.warn("⚠️ Recherche artiste Deezer (fallback) échouée", e);
        }
      }
    }

    // Si on a un deezerId (natif ou trouvé), récupérer l'artiste et ses artistes similaires
    if (deezerId) {
      console.log("🎵 Récupération artistes similaires Deezer pour:", currentSong.title || deezerId);
      
      // Récupérer l'historique d'écoute pour exclure les chansons déjà écoutées
      const { data: historyData } = await supabase
        .from('play_history')
        .select('song_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
        .order('played_at', { ascending: false })
        .limit(200);

      const historyDeezerIds = new Set(
        historyData
          ?.map(h => {
            // Extraire le deezer_id depuis les différents formats possibles
            if (h.song_id.startsWith('deezer-')) {
              return h.song_id.replace('deezer-', '');
            }
            return null;
          })
          .filter(Boolean) || []
      );

      // Ajouter les IDs de l'historique récent local
      recentHistory.forEach(song => {
        if (song.deezer_id) {
          historyDeezerIds.add(song.deezer_id);
        }
        if (song.id.startsWith('deezer-')) {
          historyDeezerIds.add(song.id.replace('deezer-', ''));
        }
      });

      // Créer un Set des artistes récents (10 derniers)
      const recentArtists = new Set(
        recentHistory.slice(-10).map(s => s.artist.toLowerCase().trim())
      );

      console.log("📊 Historique total (DB + local) à exclure:", historyDeezerIds.size, "chansons et", recentArtists.size, "artistes");
      
      // Récupérer l'ID de l'artiste si on ne l'a pas déjà
      let artistId = foundArtistId;
      
      if (!artistId) {
        // Récupérer les infos de la chanson pour avoir l'artiste
        const { data: trackData, error: trackError } = await supabase.functions.invoke('deezer-proxy', {
          body: { path: `/track/${deezerId}` }
        });
        if (trackError) {
          console.error("❌ Erreur récupération track:", trackError);
        } else if (trackData?.artist?.id) {
          artistId = trackData.artist.id;
        }
      }

      if (artistId) {
        // Récupérer les artistes similaires
        const { data: relatedData, error: relatedError } = await supabase.functions.invoke('deezer-proxy', {
          body: { 
            path: `/artist/${artistId}/related`,
            limit: Math.min(limit, 10) // Limiter le nombre d'artistes similaires
          }
        });

        if (relatedError) {
          console.error("❌ Erreur API Deezer related:", relatedError);
        } else if (relatedData?.data) {
          const relatedArtists = relatedData.data;
          console.log("👥 Artistes similaires Deezer:", relatedArtists.map((a: any) => a.name).join(", "));
          const allTracks: Song[] = [];

          // Pour chaque artiste similaire, récupérer des tracks
          for (const artist of relatedArtists.slice(0, 5)) {
            const { data: tracksData } = await supabase.functions.invoke('deezer-proxy', {
              body: { 
                path: `/artist/${artist.id}/top`,
                limit: 10 // Récupérer plusieurs chansons pour mélanger
              }
            });

            if (tracksData?.data) {
              const tracks: DeezerTrack[] = tracksData.data;
              tracks.forEach((track: DeezerTrack) => {
                // Exclure les chansons déjà écoutées ET les artistes récents
                const artistMatch = recentArtists.has(track.artist.name.toLowerCase().trim());
                if (!historyDeezerIds.has(track.id.toString()) && !artistMatch) {
                  allTracks.push({
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
                  });
                }
              });
            }
          }

          if (allTracks.length > 0) {
            // Mélanger et limiter les résultats pour avoir des tracks aléatoires
            const shuffled = shuffleArray(allTracks);
            const recommendations = shuffled.slice(0, limit);
            console.log("✅ Recommandations Deezer:", recommendations.length, "chansons aléatoires de", relatedArtists.length, "artistes similaires");
            return recommendations;
          }
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
      
      // Ajouter les IDs de l'historique récent local
      recentHistory.forEach(song => {
        excludedIds.push(song.id);
      });

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
