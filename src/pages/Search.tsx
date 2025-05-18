import { useState, useEffect } from "react";
import { Player } from "@/components/Player";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon, SlidersHorizontal, Music, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReportSongDialog } from "@/components/ReportSongDialog";
import { LyricsModal } from "@/components/LyricsModal";
import { SongCard } from "@/components/SongCard";
import { extractDominantColor } from "@/utils/colorExtractor";
import { VoiceSearchButton } from "@/components/VoiceSearchButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import DeezerSearchDialog from "@/components/DeezerSearchDialog";

const GENRES = [
  "Pop", "Rock", "Hip-Hop", "Jazz", "Électronique", 
  "Classique", "R&B", "Folk", "Blues", "Country",
  "Reggae", "Metal", "Soul", "Funk", "Dance"
];

interface ArtistResult {
  id: string;
  name: string;
  picture_medium: string;
  nb_fan: number;
}

// Define an extended song type to include optional deezer_artist_id
interface SongWithDeezer {
  id: string;
  title: string;
  artist?: string;
  duration?: string;
  file_path: string;
  image_url?: string;
  genre?: string; 
  uploaded_by?: string;
  created_at: string;
  deezer_artist_id?: string;
}

const Search = () => {
  const [searchQuery, setSearchQuery] = useState(() => {
    const savedSearch = localStorage.getItem('lastSearch') || "";
    if (savedSearch) {
      setTimeout(() => handleSearch(savedSearch), 0);
    }
    return savedSearch;
  });
  
  const [results, setResults] = useState<any[]>([]);
  const [artistResults, setArtistResults] = useState<ArtistResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "title" | "artist" | "genre" | "deezer">(() => {
    return (localStorage.getItem('lastSearchFilter') as "all" | "title" | "artist" | "genre" | "deezer") || "all";
  });
  const [selectedGenre, setSelectedGenre] = useState(() => {
    return localStorage.getItem('lastSelectedGenre') || "";
  });
  const [songToReport, setSongToReport] = useState<any>(null);
  const [songToShowLyrics, setSongToShowLyrics] = useState<any>(null);
  const [songForDeezerSearch, setSongForDeezerSearch] = useState<any>(null);
  const { play, setQueue, queue, currentSong, favorites, toggleFavorite, isPlaying, pause } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('lastSearchFilter', searchFilter);
  }, [searchFilter]);

  useEffect(() => {
    localStorage.setItem('lastSelectedGenre', selectedGenre);
  }, [selectedGenre]);

  useEffect(() => {
    if (currentSong?.imageUrl && !currentSong.imageUrl.includes('picsum.photos')) {
      extractDominantColor(currentSong.imageUrl).then(color => setDominantColor(color));
    } else {
      setDominantColor(null);
    }
  }, [currentSong?.imageUrl]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    localStorage.setItem('lastSearch', query);
    
    const isWildcardSearch = query === "*";
    
    if (!isWildcardSearch && query.length < 2 && searchFilter !== "genre") {
      setResults([]);
      setArtistResults([]);
      return;
    }

    setIsLoading(true);
    
    try {
      // Recherche normale dans la base de données Supabase
      if (searchFilter !== "deezer") {
        let queryBuilder = supabase
          .from('songs')
          .select('*');

        if (!isWildcardSearch) {
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
        }
        
        const { data, error } = await queryBuilder;

        if (error) {
          throw error;
        }

        const formattedResults = data.map((song: SongWithDeezer) => ({
          id: song.id,
          title: song.title,
          artist: song.artist || '',
          duration: song.duration || '0:00',
          url: song.file_path,
          imageUrl: song.image_url,
          bitrate: '320 kbps',
          deezerArtistId: song.deezer_artist_id ? String(song.deezer_artist_id) : undefined
        }));

        setResults(formattedResults);
        
        if (isWildcardSearch) {
          toast.success(`Tous les morceaux listés (${formattedResults.length})`);
        }
      } 
      
      // Recherche d'artistes via Deezer
      if (searchFilter === "deezer" || searchFilter === "artist") {
        // Recherche Deezer seulement si le filtre est "deezer" ou "artist"
        try {
          const { data: deezerData, error: deezerError } = await supabase.functions.invoke("deezer-search", {
            body: { query, type: 'artist' }
          });
          
          if (deezerError) {
            console.error("Erreur lors de la recherche Deezer:", deezerError);
          } else if (deezerData && deezerData.data) {
            const artists = deezerData.data.map((artist: any) => ({
              id: artist.id,
              name: artist.name,
              picture_medium: artist.picture_medium,
              nb_fan: artist.nb_fan
            }));
            setArtistResults(artists);
          }
        } catch (deezerErr) {
          console.error("Erreur lors de la recherche Deezer:", deezerErr);
          // Ne pas faire échouer toute la recherche si Deezer échoue
        }
      } else {
        // Réinitialiser les résultats d'artistes si on ne recherche pas d'artistes
        setArtistResults([]);
      }
    } catch (error) {
      console.error('Erreur de recherche:', error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = (song: any) => {
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
      return;
    }

    // Remplacer le queue pour inclure toute la liste des résultats
    setQueue(results);

    // Jouer la chanson sélectionnée
    play(song);
  };

  useEffect(() => {
    if (searchFilter === "genre" && selectedGenre) {
      handleSearch("");
    }
  }, [selectedGenre, searchFilter]);

  const handleVoiceResult = (text: string) => {
    setSearchQuery(text);
    handleSearch(text);
  };

  const handleDeezerUpdateSuccess = () => {
    // Rafraîchir la recherche après mise à jour via Deezer
    handleSearch(searchQuery);
  };

  const formatFanCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M fans`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K fans`;
    }
    return `${count} fans`;
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto p-8 pb-32">
          <style>
            {`
            @keyframes pulse-glow {
              0%, 100% {
                transform: scale(1);
                box-shadow: none;
              }
              50% {
                transform: scale(1.02);
                box-shadow: var(--glow-shadow);
              }
            }

            @keyframes gradient {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }

            @keyframes fadeIn {
              0% {
                opacity: 0;
                transform: translateY(10px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .animate-gradient {
              background-size: 200% 200%;
              animation: gradient 3s linear infinite;
            }

            .animate-pulse-glow {
              animation: pulse-glow 3s ease-in-out infinite;
            }
          `}
          </style>

          <div className="mb-8">
            <div className="flex gap-4 mb-8">
              <div className="relative flex-1 group">
                <SearchIcon className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 transition-all duration-300",
                  "group-focus-within:text-primary group-hover:text-primary",
                  "group-focus-within:scale-110 group-hover:scale-110"
                )} />
                <Input
                  type="text"
                  placeholder={
                    searchFilter === "genre" ? "Sélectionnez un genre..." : 
                    searchFilter === "deezer" ? "Rechercher un artiste sur Deezer..." :
                    "Rechercher une chanson ou un artiste (ou * pour tout afficher)"
                  }
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className={cn(
                    "pl-10 transition-all duration-300",
                    "border-2 focus:border-primary",
                    "shadow-sm hover:shadow-md focus:shadow-lg",
                    "transform-gpu",
                    "animate-fade-in",
                    "bg-gradient-to-r from-transparent via-transparent to-transparent",
                    "hover:bg-gradient-to-r hover:from-purple-50 hover:via-indigo-50 hover:to-purple-50",
                    "focus:bg-gradient-to-r focus:from-purple-50 focus:via-indigo-50 focus:to-purple-50",
                    "dark:hover:from-purple-900/10 dark:hover:via-indigo-900/10 dark:hover:to-purple-900/10",
                    "dark:focus:from-purple-900/10 dark:focus:via-indigo-900/10 dark:focus:to-purple-900/10"
                  )}
                  style={{
                    backgroundSize: '200% 100%',
                  }}
                  onFocus={(e) => {
                    e.target.style.backgroundPosition = '100% 0';
                  }}
                  onBlur={(e) => {
                    e.target.style.backgroundPosition = '0 0';
                  }}
                  disabled={searchFilter === "genre"}
                />
                <div className={cn(
                  "absolute inset-0 pointer-events-none",
                  "opacity-0 group-focus-within:opacity-100",
                  "transition-all duration-500",
                  "rounded-md",
                  "bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10",
                  "animate-gradient",
                  "group-focus-within:animate-[glow_1.5s_ease-in-out_infinite]"
                )} />
              </div>

              <VoiceSearchButton onVoiceResult={handleVoiceResult} />

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-white/5 transition-colors">
                  <SlidersHorizontal className="h-5 w-5" />
                  <span className="text-sm">
                    {searchFilter === "all" ? "Tout" : 
                     searchFilter === "title" ? "Titre" : 
                     searchFilter === "artist" ? "Artiste" : 
                     searchFilter === "deezer" ? "Artiste Deezer" : "Genre"}
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
                  <DropdownMenuItem onClick={() => {
                    setSearchFilter("deezer");
                    setSelectedGenre("");
                  }}>
                    <User className="h-4 w-4 mr-2" />
                    Artiste Deezer
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
            ) : (
              <>
                {/* Résultats d'artistes Deezer */}
                {artistResults.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                      <User className="mr-2 h-5 w-5 text-spotify-accent" /> 
                      Artistes
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {artistResults.map((artist, index) => (
                        <Card 
                          key={artist.id}
                          className="overflow-hidden bg-white/5 hover:bg-white/10 transition-all duration-300 hover:shadow-lg border-0"
                          style={{ 
                            animation: `fadeIn 0.3s ease-out forwards ${index * 50}ms`,
                            opacity: 0
                          }}
                          onClick={() => navigate(`/artist/${artist.id}`)}
                        >
                          <div className="p-4 cursor-pointer flex flex-col items-center text-center">
                            <div className="relative w-24 h-24 mb-3 group">
                              <img 
                                src={artist.picture_medium} 
                                alt={artist.name}
                                className="w-24 h-24 rounded-full object-cover group-hover:scale-105 transition-transform duration-300" 
                              />
                              <div className="absolute inset-0 bg-spotify-accent/0 group-hover:bg-spotify-accent/10 rounded-full transition-all duration-300 flex items-center justify-center">
                                <User className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </div>
                            </div>
                            <h3 className="font-medium text-sm mb-1 line-clamp-1">{artist.name}</h3>
                            <p className="text-xs text-spotify-neutral">{formatFanCount(artist.nb_fan)}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              
                {/* Résultats de musiques */}
                {results.length > 0 && (
                  <div>
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                      <Music className="mr-2 h-5 w-5 text-spotify-accent" /> 
                      Musiques
                    </h2>
                    <div className="space-y-2">
                      {results.map((song, index) => {
                        const isFavorite = favorites.some(s => s.id === song.id);
                        const isCurrentSong = currentSong?.id === song.id;
                        console.log("Song in Search rendering:", song.title, "deezerArtistId:", song.deezerArtistId);
                        
                        return (
                          <div
                            key={song.id}
                            style={{ 
                              animation: `fadeIn 0.3s ease-out forwards ${index * 50}ms`,
                              opacity: 0,
                            }}
                            onClick={() => handlePlay(song)}
                          >
                            <SongCard
                              song={song}
                              isCurrentSong={isCurrentSong}
                              isFavorite={isFavorite}
                              dominantColor={dominantColor}
                              onLyricsClick={() => setSongToShowLyrics(song)}
                              onReportClick={() => setSongToReport(song)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {artistResults.length === 0 && results.length === 0 && searchQuery ? (
                  <div className="text-center py-12 text-muted-foreground animate-fade-in">
                    Aucun résultat trouvé pour "{searchQuery}"
                    <div className="mt-4">
                      <Button 
                        variant="outline"
                        onClick={() => setSongForDeezerSearch({
                          title: searchQuery,
                          artist: "Inconnu"
                        })}
                        className="mx-auto"
                      >
                        Rechercher "{searchQuery}" sur Deezer
                      </Button>
                    </div>
                  </div>
                ) : (!searchQuery && (
                  <div className="text-center py-12 text-muted-foreground animate-fade-in">
                    Commencez à taper pour rechercher des chansons ou utilisez "*" pour tout afficher...
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      <Player />
      <ReportSongDialog
        song={songToReport}
        onClose={() => setSongToReport(null)}
      />
      {songToShowLyrics && (
        <LyricsModal
          isOpen={!!songToShowLyrics}
          onClose={() => setSongToShowLyrics(null)}
          songId={songToShowLyrics.id}
          songTitle={songToShowLyrics.title}
          artist={songToShowLyrics.artist}
        />
      )}
      <DeezerSearchDialog
        open={!!songForDeezerSearch}
        onClose={() => setSongForDeezerSearch(null)}
        song={songForDeezerSearch}
        onUpdateSuccess={handleDeezerUpdateSuccess}
      />
    </div>
  );
};

export default Search;
