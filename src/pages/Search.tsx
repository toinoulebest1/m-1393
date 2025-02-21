import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon, Clock, Signal, Heart, Flag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ColorThief from 'colorthief';
import { ReportSongDialog } from "@/components/ReportSongDialog";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  file_path: string;
  imageUrl?: string;
}

const Search = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { play, currentSong, favorites, toggleFavorite } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [songToReport, setSongToReport] = useState<Song | null>(null);

  const extractDominantColor = async (imageUrl: string) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      const colorThief = new ColorThief();
      const color = colorThief.getColor(img);
      const saturatedColor: [number, number, number] = [
        Math.min(255, color[0] * 1.2),
        Math.min(255, color[1] * 1.2),
        Math.min(255, color[2] * 1.2)
      ];
      setDominantColor(saturatedColor);
    } catch (error) {
      console.error('Erreur lors de l\'extraction de la couleur:', error);
      setDominantColor(null);
    }
  };

  useEffect(() => {
    if (currentSong?.imageUrl && !currentSong.imageUrl.includes('picsum.photos')) {
      extractDominantColor(currentSong.imageUrl);
    } else {
      setDominantColor(null);
    }
  }, [currentSong?.imageUrl]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const uniqueSongs = data.reduce((acc: Song[], current) => {
        const key = `${current.title.toLowerCase()}-${(current.artist || '').toLowerCase()}`;
        const existingSong = acc.find(song => 
          `${song.title.toLowerCase()}-${(song.artist || '').toLowerCase()}` === key
        );
        
        if (!existingSong) {
          acc.push({
            id: current.id,
            title: current.title,
            artist: current.artist || '',
            duration: current.duration || '0:00',
            url: current.file_path,
            file_path: current.file_path,
            imageUrl: current.image_url
          });
        }
        return acc;
      }, []);

      setResults(uniqueSongs);
    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-spotify-dark">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 pb-32">
        <div className="max-w-3xl mx-auto">
          <div className="relative mb-8">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              type="text"
              placeholder="Rechercher une chanson ou un artiste..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 bg-background/50"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((song, index) => {
                const isFavorite = favorites.some(s => s.id === song.id);
                const isCurrentSong = currentSong?.id === song.id;
                const glowStyle = isCurrentSong && dominantColor ? {
                  boxShadow: `
                    0 0 10px 5px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.3),
                    0 0 20px 10px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2),
                    0 0 30px 15px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.1)
                  `,
                  transition: 'all 0.3s ease-in-out',
                  transform: isCurrentSong ? 'scale(1.05)' : 'scale(1)',
                } : {};

                const containerGlowStyle = isCurrentSong && dominantColor ? {
                  boxShadow: `
                    0 0 15px 2px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2),
                    0 0 30px 5px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.1)
                  `,
                  background: `rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.1)`,
                } : {};

                return (
                  <div
                    key={song.id}
                    className={cn(
                      "group flex items-center justify-between p-4 rounded-lg transition-all duration-500 cursor-pointer hover:bg-white/5",
                      isCurrentSong 
                        ? "relative bg-white/5 shadow-lg overflow-hidden" 
                        : "bg-transparent"
                    )}
                    style={{ 
                      animation: `fadeIn 0.3s ease-out forwards ${index * 50}ms`,
                      opacity: 0,
                      ...containerGlowStyle
                    }}
                    onClick={() => play(song)}
                  >
                    {isCurrentSong && (
                      <div className="absolute inset-0 z-0 overflow-hidden">
                        <div 
                          className="absolute inset-0 animate-gradient opacity-30" 
                          style={{
                            backgroundSize: '200% 200%',
                            animation: 'gradient 3s linear infinite',
                            background: dominantColor 
                              ? `linear-gradient(45deg, 
                                  rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.8),
                                  rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.4)
                                )`
                              : 'linear-gradient(45deg, #8B5CF6, #D946EF, #0EA5E9)',
                          }}
                        />
                      </div>
                    )}

                    <div className="relative z-10 flex items-center justify-between w-full">
                      <div className="flex items-center flex-1">
                        <div 
                          className={cn(
                            "relative overflow-hidden rounded-md transition-all duration-500",
                            isCurrentSong ? "shadow-2xl" : "group-hover:shadow-xl"
                          )}
                          style={glowStyle}
                        >
                          <img
                            src={song.imageUrl || "https://picsum.photos/56/56"}
                            alt={song.title}
                            className={cn(
                              "w-14 h-14 object-cover rounded-md transition-all duration-500",
                              isCurrentSong ? "scale-105 [animation:pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]" : "group-hover:scale-105"
                            )}
                          />
                          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
                        </div>
                        <div className="ml-4">
                          <h3 className={cn(
                            "font-medium transition-colors",
                            isCurrentSong ? "text-white" : "text-spotify-neutral hover:text-white"
                          )}>
                            {song.title}
                          </h3>
                          <p className="text-sm text-spotify-neutral group-hover:text-white/80 transition-colors duration-300">
                            {song.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(song);
                          }}
                          className="p-2 hover:bg-white/5 rounded-full transition-colors group relative"
                        >
                          <Heart
                            className={cn(
                              "w-5 h-5 transition-all duration-300 hover:scale-110",
                              isFavorite
                                ? "text-red-500 fill-red-500"
                                : "text-spotify-neutral hover:text-white"
                            )}
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSongToReport(song);
                          }}
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10 p-2 rounded-full transition-colors"
                        >
                          <Flag className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : searchQuery ? (
            <div className="text-center py-12 text-muted-foreground animate-fade-in">
              Aucun résultat trouvé pour "{searchQuery}"
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground animate-fade-in">
              Commencez à taper pour rechercher des chansons...
            </div>
          )}
        </div>
      </div>
      <Player />
      <ReportSongDialog
        song={songToReport}
        onClose={() => setSongToReport(null)}
      />
    </div>
  );
};

export default Search;
