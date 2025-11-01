import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SongCard } from "./SongCard";
import { Sparkles } from "lucide-react";
import { usePlayerContext } from "@/contexts/PlayerContext";

export const MusicDiscovery = () => {
  const [suggestedSongs, setSuggestedSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentSong } = usePlayerContext();

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        // Récupérer les préférences musicales de l'utilisateur
        const { data: preferences } = await supabase
          .from('music_preferences')
          .select('favorite_genres')
          .eq('user_id', session.user.id)
          .single();

        // Récupérer l'historique récent pour identifier les genres/artistes écoutés
        const { data: recentHistory } = await supabase
          .from('play_history')
          .select(`
            song_id,
            songs (
              id,
              title,
              artist,
              genre,
              image_url,
              duration,
              file_path,
              album_name
            )
          `)
          .eq('user_id', session.user.id)
          .order('played_at', { ascending: false })
          .limit(20);

        // Extraire les genres et artistes de l'historique récent
        const recentGenres = new Set<string>();
        const recentArtists = new Set<string>();
        
        recentHistory?.forEach((item: any) => {
          if (item.songs?.genre) recentGenres.add(item.songs.genre);
          if (item.songs?.artist) recentArtists.add(item.songs.artist);
        });

        // Combiner avec les genres favoris
        const allGenres = new Set([
          ...Array.from(recentGenres),
          ...(preferences?.favorite_genres || []).map((g: any) => g.name || g)
        ]);

        // Récupérer des chansons correspondant aux goûts
        let query = supabase
          .from('songs')
          .select('*')
          .limit(12);

        // Filtrer par genre si disponible
        if (allGenres.size > 0) {
          query = query.in('genre', Array.from(allGenres));
        }

        const { data: songs } = await query;

        if (songs) {
          // Exclure les chansons déjà dans l'historique récent
          const recentSongIds = new Set(
            recentHistory?.map((item: any) => item.songs?.id).filter(Boolean)
          );
          
          const filteredSongs = songs
            .filter(song => !recentSongIds.has(song.id))
            .map(song => ({
              id: song.id,
              title: song.title,
              artist: song.artist || "Artiste inconnu",
              imageUrl: song.image_url || "",
              url: song.file_path,
              duration: song.duration || "0:00",
              genre: song.genre,
              albumName: song.album_name,
              tidal_id: (song as any).tidal_id
            }));

          // Mélanger et limiter à 8 suggestions
          const shuffled = filteredSongs.sort(() => Math.random() - 0.5).slice(0, 8);
          setSuggestedSongs(shuffled);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, []);

  if (loading) {
    return (
      <div className="w-full px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-6 h-6 text-spotify-accent animate-pulse" />
          <h2 className="text-2xl font-bold">Découverte</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(8)].map((_, i) => (
            <div 
              key={i} 
              className="h-64 rounded-lg bg-gradient-to-br from-spotify-dark/50 to-spotify-dark animate-pulse relative overflow-hidden"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" 
                   style={{ 
                     animationDelay: `${i * 0.15}s`,
                     backgroundSize: '200% 100%'
                   }} 
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-spotify-accent/30 border-t-spotify-accent rounded-full animate-spin" 
                     style={{ animationDelay: `${i * 0.05}s` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (suggestedSongs.length === 0) {
    return null;
  }

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-6 h-6 text-spotify-accent animate-pulse" />
        <h2 className="text-2xl font-bold">Découvrez de nouvelles musiques</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestedSongs.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            isCurrentSong={currentSong?.id === song.id}
          />
        ))}
      </div>
    </div>
  );
};
