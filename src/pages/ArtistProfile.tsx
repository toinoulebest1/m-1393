
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Player } from "@/components/Player";
import { Spinner } from "@/components/ui/spinner";
import { SongCard } from "@/components/SongCard";
import { usePlayer } from "@/contexts/PlayerContext";
import { extractDominantColor } from "@/utils/colorExtractor";
import { toast } from "sonner";
import { Music, Disc, Users } from "lucide-react";

interface DeezerArtist {
  id: number;
  name: string;
  picture_xl: string;
  nb_album: number;
  nb_fan: number;
  radio: boolean;
  tracklist: string;
}

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  preview: string;
  artist: {
    id: number;
    name: string;
    picture_medium: string;
  };
  album: {
    id: number;
    title: string;
    cover_medium: string;
  };
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const ArtistProfile = () => {
  const { artistId } = useParams();
  const [artist, setArtist] = useState<DeezerArtist | null>(null);
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { currentSong, favorites, play, setQueue } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  
  useEffect(() => {
    const fetchArtistData = async () => {
      setLoading(true);
      try {
        // Fetch artist details
        const artistResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deezer-proxy?path=/artist/${artistId}`);
        
        if (!artistResponse.ok) {
          throw new Error(`Erreur lors de la récupération des données de l'artiste: ${artistResponse.status}`);
        }
        
        const artistData = await artistResponse.json();
        setArtist(artistData);
        
        // Extract dominant color from artist image
        if (artistData.picture_xl) {
          extractDominantColor(artistData.picture_xl).then(color => setDominantColor(color));
        }
        
        // Fetch top tracks
        const tracksResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deezer-proxy?path=/artist/${artistId}/top`);
        
        if (!tracksResponse.ok) {
          throw new Error(`Erreur lors de la récupération des titres de l'artiste: ${tracksResponse.status}`);
        }
        
        const tracksData = await tracksResponse.json();
        
        // Format tracks data
        const formattedTracks = tracksData.data.map((track: DeezerTrack) => ({
          id: `deezer-${track.id}`,
          title: track.title,
          artist: track.artist.name,
          duration: formatDuration(track.duration),
          url: track.preview,
          imageUrl: track.album.cover_medium,
          bitrate: '128 kbps',
          deezerArtistId: track.artist.id
        }));
        
        setTopTracks(formattedTracks);
      } catch (err) {
        console.error("Erreur:", err);
        setError(err instanceof Error ? err.message : "Une erreur est survenue");
        toast.error("Erreur lors du chargement des données de l'artiste");
      } finally {
        setLoading(false);
      }
    };
    
    fetchArtistData();
  }, [artistId]);

  const handlePlayAll = () => {
    if (topTracks.length > 0) {
      setQueue(topTracks);
      play(topTracks[0]);
      toast.success("Lecture de la discographie de l'artiste");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-spotify-base">
        <div className="flex flex-col items-center">
          <Spinner className="h-12 w-12" />
          <p className="mt-4 text-spotify-neutral">Chargement du profil de l'artiste...</p>
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="flex items-center justify-center h-screen bg-spotify-base">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Artiste non trouvé</h2>
          <p className="text-spotify-neutral mb-6">{error || "Impossible de charger les données de l'artiste"}</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-spotify-accent hover:bg-spotify-accent/80 rounded-full transition-all"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto p-8 pb-32">
          {/* Header with artist info */}
          <div
            className="w-full rounded-lg mb-8 p-8 relative overflow-hidden"
            style={{
              background: dominantColor
                ? `linear-gradient(to bottom right, rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.8), rgba(18, 18, 18, 1))`
                : "linear-gradient(to bottom right, rgba(80, 80, 80, 0.8), rgba(18, 18, 18, 1))"
            }}
          >
            <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
              <div className="relative group">
                <img 
                  src={artist.picture_xl} 
                  alt={artist.name} 
                  className="w-48 h-48 rounded-full object-cover shadow-xl group-hover:scale-105 transition-all duration-300"
                />
                <div className="absolute top-0 right-0 bg-spotify-accent text-white p-2 rounded-full shadow-lg transform translate-x-1/4 -translate-y-1/4 rotate-12 transition-transform group-hover:rotate-0">
                  <Music size={16} />
                </div>
              </div>
              <div className="text-center md:text-left">
                <h1 className="text-4xl font-bold mb-2">{artist.name}</h1>
                <div className="flex flex-wrap gap-6 items-center justify-center md:justify-start mt-3">
                  <div className="flex items-center gap-2">
                    <Disc className="h-5 w-5 text-spotify-accent" />
                    <span className="text-sm">{artist.nb_album} albums</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-spotify-accent" />
                    <span className="text-sm">{artist.nb_fan.toLocaleString()} fans</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handlePlayAll}
              disabled={topTracks.length === 0}
              className="absolute bottom-8 right-8 px-6 py-3 bg-spotify-accent hover:bg-spotify-accent/80 rounded-full transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Music className="h-5 w-5" />
              Écouter
            </button>
          </div>

          {/* Back button */}
          <div className="mb-6">
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-sm"
            >
              ← Retour à la recherche
            </Link>
          </div>

          {/* Titles list */}
          <h2 className="text-2xl font-bold mb-6">Top titres</h2>
          {topTracks.length > 0 ? (
            <div className="space-y-2">
              {topTracks.map((song, index) => {
                const isFavorite = favorites.some(s => s.id === song.id);
                const isCurrentSong = currentSong?.id === song.id;
                
                return (
                  <div
                    key={song.id}
                    className="song-card-animation"
                    style={{ 
                      animationDelay: `${index * 50}ms`
                    }}
                  >
                    <SongCard
                      song={song}
                      isCurrentSong={isCurrentSong}
                      isFavorite={isFavorite}
                      dominantColor={dominantColor}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-spotify-neutral">
              Aucun titre disponible pour cet artiste
            </div>
          )}
        </div>
      </div>
      <Player />
      
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .song-card-animation {
            opacity: 0;
            animation: fadeIn 0.3s ease-out forwards;
          }
        `}
      </style>
    </div>
  );
};

export default ArtistProfile;
