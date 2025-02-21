import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon, Clock, Signal, Heart, Flag, SlidersHorizontal, Music } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ColorThief from 'colorthief';
import { ReportSongDialog } from "@/components/ReportSongDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const GENRES = [
  "Pop", "Rock", "Hip-Hop", "Jazz", "Électronique", 
  "Classique", "R&B", "Folk", "Blues", "Country",
  "Reggae", "Metal", "Soul", "Funk", "Dance"
];

const Search = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "title" | "artist" | "genre">("all");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [songToReport, setSongToReport] = useState<any>(null);
  const { play, setQueue, queue, currentSong, favorites, toggleFavorite } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2 && searchFilter !== "genre") {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      let queryBuilder = supabase
        .from('songs')
        .select('*');

      if (searchFilter === "title") {
        queryBuilder = queryBuilder.ilike('title', `%${query}%`);
      } else if (searchFilter === "artist") {
        queryBuilder = queryBuilder.ilike('artist', `%${query}%`);
      } else if (searchFilter === "genre") {
        if (selectedGenre) {
          queryBuilder = queryBuilder.eq('genre', selectedGenre);
        }
      } else {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        throw error;
      }

      const formattedResults = data.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist || '',
        duration: song.duration || '0:00',
        url: song.file_path,
        imageUrl: song.image_url,
        bitrate: '320 kbps'
      }));

      setResults(formattedResults);
    } catch (error) {
      console.error('Erreur de recherche:', error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = (song: any) => {
    const updatedQueue = [song, ...results.filter(s => s.id !== song.id)];
    setQueue(updatedQueue);
    play(song);
  };

  useEffect(() => {
    if (searchFilter === "genre" && selectedGenre) {
      handleSearch("");
    }
  }, [selectedGenre, searchFilter]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 pb-32">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-4 mb-8">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                placeholder={searchFilter === "genre" ? "Sélectionnez un genre..." : "Rechercher une chanson ou un artiste..."}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
                disabled={searchFilter === "genre"}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-white/5 transition-colors">
                <SlidersHorizontal className="h-5 w-5" />
                <span className="text-sm">
                  {searchFilter === "all" ? "Tout" : 
                   searchFilter === "title" ? "Titre" : 
                   searchFilter === "artist" ? "Artiste" : "Genre"}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  setSearchFilter("all");
                  setSelectedGenre("");
                }}>
                  Tout
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setSearchFilter("title");
                  setSelectedGenre("");
                }}>
                  Titre
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setSearchFilter("artist");
                  setSelectedGenre("");
                }}>
                  Artiste
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSearchFilter("genre")}>
                  <Music className="h-4 w-4 mr-2" />
                  Genre musical
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {searchFilter === "genre" && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-white/5 transition-colors">
                  <Music className="h-5 w-5" />
                  <span className="text-sm">
                    {selectedGenre || "Sélectionner un genre"}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {GENRES.map((genre) => (
                    <DropdownMenuItem 
                      key={genre}
                      onClick={() => setSelectedGenre(genre)}
                    >
                      {genre}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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

                return (
                  <div
                    key={song.id}
                    className={cn(
                      "group flex items-center justify-between p-4 rounded-lg transition-all duration-500 cursor-pointer",
                      isCurrentSong ? "bg-white/5" : "hover:bg-white/5"
                    )}
                    style={{ 
                      animation: `fadeIn 0.3s ease-out forwards ${index * 50}ms`,
                      opacity: 0,
                    }}
                    onClick={() => handlePlay(song)}
                  >
                    <div className="relative z-10 flex items-center justify-between w-full">
                      <div className="flex items-center flex-1">
                        <div 
                          className="relative overflow-hidden rounded-md"
                          style={glowStyle}
                        >
                          <img
                            src={song.imageUrl || "https://picsum.photos/56/56"}
                            alt={song.title}
                            className="w-14 h-14 object-cover rounded-md"
                          />
                        </div>
                        <div className="ml-4">
                          <h3 className={cn(
                            "font-medium",
                            isCurrentSong ? "text-white" : "text-spotify-neutral group-hover:text-white"
                          )}>
                            {song.title}
                          </h3>
                          <p className="text-sm text-spotify-neutral group-hover:text-white/80">
                            {song.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-1 text-spotify-neutral">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">{song.duration || "0:00"}</span>
                        </div>

                        <div className="flex items-center space-x-1 text-spotify-neutral">
                          <Signal className="w-4 h-4" />
                          <span className="text-sm">320 kbps</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(song);
                            }}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors"
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
                            className="p-2 hover:bg-white/5 rounded-full transition-colors"
                          >
                            <Flag className="w-5 h-5 text-spotify-neutral hover:text-white transition-all duration-300 hover:scale-110" />
                          </button>
                        </div>
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
