
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/components/Player";
import { Button } from "@/components/ui/button";
import { SongCard } from "@/components/SongCard";
import { usePlayer } from "@/contexts/PlayerContext";
import { extractDominantColor } from "@/utils/colorExtractor";
import { toast } from "sonner";
import { Music, User, Disc, BarChart2, Globe, Calendar, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

interface Artist {
  id: number;
  name: string;
  picture_xl: string;
  nb_album: number;
  nb_fan: number;
  share: string;
  tracklist: string;
  type: string;
  link: string;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl: string;
  bitrate?: string;
}

const ArtistProfile = () => {
  const { artistId } = useParams<{ artistId: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const { currentSong, favorites, play, setQueue, isPlaying, pause } = usePlayer();

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!artistId) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke('deezer-artist', {
          body: { artistId }
        });

        if (error) {
          console.error("Error fetching artist:", error);
          toast.error("Impossible de charger les données de l'artiste");
          return;
        }

        if (data?.artist) {
          setArtist(data.artist);
          
          // Extract dominant color from artist image
          if (data.artist.picture_xl) {
            extractDominantColor(data.artist.picture_xl).then(color => {
              setDominantColor(color);
            });
          }
        }
        
        if (data?.tracks) {
          // Format track data to match our application's format
          const formattedTracks = data.tracks.map((track: any) => ({
            id: String(track.id),
            title: track.title,
            artist: track.artist.name,
            duration: formatDuration(track.duration),
            url: track.preview || "", // Use preview URL from Deezer
            imageUrl: track.album.cover_xl || "",
            bitrate: "128 kbps" // Deezer preview quality
          }));
          setTopTracks(formattedTracks);
        }
      } catch (err) {
        console.error("Error:", err);
        toast.error("Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchArtistData();
  }, [artistId]);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const playAllTracks = () => {
    if (topTracks.length === 0) return;
    setQueue(topTracks);
    play(topTracks[0]);
  };

  return (
    <Layout>
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-6xl mx-auto p-8 pb-32">
            {/* Back button */}
            <Link to="/search" className="flex items-center mb-8 text-spotify-neutral hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Retour à la recherche
            </Link>
            
            {loading ? (
              <div className="space-y-8 animate-pulse">
                <div className="flex flex-col md:flex-row gap-8">
                  <Skeleton className="w-64 h-64 rounded-lg" />
                  <div className="space-y-4 flex-1">
                    <Skeleton className="h-12 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                    <div className="flex gap-4 mt-4">
                      <Skeleton className="h-10 w-32" />
                      <Skeleton className="h-10 w-32" />
                    </div>
                  </div>
                </div>
              </div>
            ) : artist ? (
              <>
                <div className="relative">
                  {/* Gradient background based on dominant color */}
                  <div 
                    className="absolute top-0 left-0 w-full h-64 -z-10 opacity-20 rounded-xl"
                    style={{
                      background: dominantColor ? 
                        `linear-gradient(to bottom right, rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.8), rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2))` : 
                        "linear-gradient(to bottom right, rgba(155, 135, 245, 0.8), rgba(155, 135, 245, 0.2))"
                    }}
                  ></div>
                  
                  <div className="flex flex-col md:flex-row gap-8 animate-fade-in">
                    {/* Artist image with glow effect */}
                    <div 
                      className="relative overflow-hidden rounded-lg shadow-xl"
                      style={{
                        boxShadow: dominantColor ? 
                          `0 10px 30px -5px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.3)` : 
                          "0 10px 30px -5px rgba(155, 135, 245, 0.3)"
                      }}
                    >
                      <img 
                        src={artist.picture_xl} 
                        alt={artist.name}
                        className="w-64 h-64 object-cover rounded-lg transition-transform hover:scale-105 duration-700"
                      />
                    </div>
                    
                    {/* Artist information */}
                    <div className="flex-1">
                      <h1 className="text-4xl font-bold mb-2 text-gradient animate-fade-in">{artist.name}</h1>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg transition-all hover:bg-white/10 animate-fade-in" style={{animationDelay: "100ms"}}>
                          <Disc className="w-5 h-5 text-spotify-accent" />
                          <div>
                            <p className="text-xs text-spotify-neutral">Albums</p>
                            <p className="font-medium">{artist.nb_album || "N/A"}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg transition-all hover:bg-white/10 animate-fade-in" style={{animationDelay: "200ms"}}>
                          <User className="w-5 h-5 text-spotify-accent" />
                          <div>
                            <p className="text-xs text-spotify-neutral">Fans</p>
                            <p className="font-medium">{formatNumber(artist.nb_fan || 0)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg transition-all hover:bg-white/10 animate-fade-in" style={{animationDelay: "300ms"}}>
                          <BarChart2 className="w-5 h-5 text-spotify-accent" />
                          <div>
                            <p className="text-xs text-spotify-neutral">Popularité</p>
                            <p className="font-medium">★★★★☆</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg transition-all hover:bg-white/10 animate-fade-in" style={{animationDelay: "400ms"}}>
                          <Globe className="w-5 h-5 text-spotify-accent" />
                          <div>
                            <p className="text-xs text-spotify-neutral">Site</p>
                            <a 
                              href={artist.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-medium hover:text-spotify-accent transition-colors"
                            >
                              Deezer
                            </a>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex gap-3">
                        <Button 
                          onClick={playAllTracks}
                          className="gap-2 bg-spotify-accent hover:bg-spotify-accent-hover"
                          disabled={topTracks.length === 0}
                        >
                          <Music className="w-4 h-4" />
                          Écouter les top titres
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Top tracks */}
                <div className="mt-12 animate-fade-in" style={{animationDelay: "500ms"}}>
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-spotify-accent" />
                    Top Titres
                  </h2>
                  
                  {topTracks.length > 0 ? (
                    <div className="space-y-2">
                      {topTracks.map((track, index) => {
                        const isFavorite = favorites.some(s => s.id === track.id);
                        const isCurrentSong = currentSong?.id === track.id;
                        
                        return (
                          <div
                            key={track.id}
                            style={{ 
                              animation: `fadeIn 0.3s ease-out forwards ${index * 50}ms`,
                              opacity: 0,
                            }}
                            onClick={() => {
                              if (isCurrentSong) {
                                isPlaying ? pause() : play();
                              } else {
                                play(track);
                              }
                            }}
                          >
                            <SongCard
                              song={track}
                              isCurrentSong={isCurrentSong}
                              isFavorite={isFavorite}
                              dominantColor={dominantColor}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      Aucun titre disponible pour cet artiste
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground animate-fade-in">
                Artiste non trouvé
              </div>
            )}
          </div>
        </div>
        <Player />
      </div>
    </Layout>
  );
};

export default ArtistProfile;
