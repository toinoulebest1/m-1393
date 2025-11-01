import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SongCard } from "./SongCard";
import { Sparkles } from "lucide-react";
import { usePlayerContext } from "@/contexts/PlayerContext";

const POPULAR_SEARCH_TERMS = [
  "top français",
  "hits 2024",
  "pop française",
  "rap français",
  "musique tendance"
];

export const MusicDiscovery = () => {
  const [suggestedSongs, setSuggestedSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentSong } = usePlayerContext();

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        // Sélectionner un terme de recherche aléatoire
        const randomTerm = POPULAR_SEARCH_TERMS[Math.floor(Math.random() * POPULAR_SEARCH_TERMS.length)];
        
        // Rechercher des chansons via l'API Deezer
        const { data, error } = await supabase.functions.invoke('deezer-search', {
          body: { query: randomTerm }
        });

        if (error) {
          console.error("Erreur lors de la recherche Deezer:", error);
          setLoading(false);
          return;
        }

        if (data?.data && Array.isArray(data.data)) {
          const formattedSongs = data.data.slice(0, 8).map((track: any) => ({
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
