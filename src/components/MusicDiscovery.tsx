import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SongCard } from "./SongCard";
import { Sparkles } from "lucide-react";
import { usePlayerContext } from "@/contexts/PlayerContext";

const DIVERSE_GENRES = [
  "rock",
  "jazz",
  "electronic",
  "classical",
  "reggae",
  "metal",
  "blues",
  "country",
  "latin",
  "soul",
  "funk",
  "indie",
  "folk",
  "r&b"
];

export const MusicDiscovery = () => {
  const [suggestedSongs, setSuggestedSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentSong } = usePlayerContext();

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        // Sélectionner 4 genres aléatoires différents
        const shuffledGenres = [...DIVERSE_GENRES].sort(() => Math.random() - 0.5);
        const selectedGenres = shuffledGenres.slice(0, 4);
        
        console.log("🎵 Genres sélectionnés pour la découverte:", selectedGenres);
        
        // Faire une recherche pour chaque genre (2 musiques par genre = 8 total)
        const searchPromises = selectedGenres.map(genre => 
          supabase.functions.invoke('deezer-search', {
            body: { query: genre, limit: 10 }
          })
        );
        
        const results = await Promise.all(searchPromises);
        
        const allTracks = [];
        for (const result of results) {
          if (!result.error && result.data?.data && Array.isArray(result.data.data)) {
            // Prendre 2 musiques aléatoires de chaque genre
            const shuffled = [...result.data.data].sort(() => Math.random() - 0.5);
            allTracks.push(...shuffled.slice(0, 2));
          }
        }
        
        // Mélanger le résultat final pour mélanger les genres
        const finalTracks = allTracks.sort(() => Math.random() - 0.5).slice(0, 8);
        
        const formattedSongs = finalTracks.map((track: any) => ({
          id: `deezer-${track.id}`,
          title: track.title,
          artist: track.artist?.name || "Artiste inconnu",
          imageUrl: track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || "",
          url: track.preview || "",
          duration: track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : "0:00",
          genre: "",
          albumName: track.album?.title || "",
          deezer_id: track.id
        }));

        setSuggestedSongs(formattedSongs);
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
