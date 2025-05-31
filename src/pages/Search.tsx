
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Player } from "@/components/Player";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon, Music, User, List, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReportSongDialog } from "@/components/ReportSongDialog";
import { SongCard } from "@/components/SongCard";
import { extractDominantColor } from "@/utils/colorExtractor";
import { VoiceSearchButton } from "@/components/VoiceSearchButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { searchArtist } from "@/services/deezerApi";

const GENRES = [
  "Pop", "Rock", "Hip-Hop", "Jazz", "Électronique", 
  "Classique", "R&B", "Folk", "Blues", "Country",
  "Reggae", "Metal", "Soul", "Funk", "Dance"
];

const Search = () => {
  const [searchQuery, setSearchQuery] = useState(() => {
    const savedSearch = localStorage.getItem('lastSearch') || "";
    if (savedSearch) {
      setTimeout(() => handleSearch(savedSearch), 0);
    }
    return savedSearch;
  });
  
  const [results, setResults] = useState<any[]>([]);
  const [playlistResults, setPlaylistResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "title" | "artist" | "genre" | "playlist">(() => {
    return (localStorage.getItem('lastSearchFilter') as "all" | "title" | "artist" | "genre" | "playlist") || "all";
  });
  const [selectedGenre, setSelectedGenre] = useState(() => {
    return localStorage.getItem('lastSelectedGenre') || "";
  });
  const [songToReport, setSongToReport] = useState<any>(null);
  const { play, setQueue, queue, currentSong, favorites, toggleFavorite, isPlaying, pause } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('lastSearchFilter', searchFilter);
    // Trigger search when filter changes and there's a query
    if (searchQuery) {
      handleSearch(searchQuery);
    }
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
      setPlaylistResults([]);
      return;
    }

    setIsLoading(true);
    try {
      if (searchFilter === "playlist") {
        // Search in playlists only
        let playlistQuery = supabase
          .from('playlists')
          .select('*');

        if (!isWildcardSearch) {
          playlistQuery = playlistQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
        }

        const { data: playlistData, error: playlistError } = await playlistQuery;

        if (playlistError) {
          throw playlistError;
        }

        setPlaylistResults(playlistData || []);
        setResults([]);
        
        if (isWildcardSearch) {
          toast.success(`Toutes les playlists listées (${playlistData?.length || 0})`);
        }
      } else if (searchFilter === "all") {
        // Search in both songs and playlists
        const promises = [];
        
        // Search songs
        let songQuery = supabase
          .from('songs')
          .select('*');

        if (!isWildcardSearch) {
          songQuery = songQuery.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
        }
        
        promises.push(songQuery);

        // Search playlists
        let playlistQuery = supabase
          .from('playlists')
          .select('*');

        if (!isWildcardSearch) {
          playlistQuery = playlistQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
        }

        promises.push(playlistQuery);

        const [songResult, playlistResult] = await Promise.all(promises);

        if (songResult.error) {
          throw songResult.error;
        }
        if (playlistResult.error) {
          throw playlistResult.error;
        }

        const formattedResults = songResult.data.map(song => ({
          id: song.id,
          title: song.title,
          artist: song.artist || '',
          duration: song.duration || '0:00',
          url: song.file_path,
          imageUrl: song.image_url,
          bitrate: '320 kbps'
        }));

        setResults(formattedResults);
        setPlaylistResults(playlistResult.data || []);
        
        if (isWildcardSearch) {
          toast.success(`Tous les morceaux (${formattedResults.length}) et playlists (${playlistResult.data?.length || 0}) listés`);
        }
      } else {
        // Search in songs only (title, artist, genre filters)
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
          }
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
        setPlaylistResults([]);
        
        if (isWildcardSearch) {
          toast.success(`Tous les morceaux listés (${formattedResults.length})`);
        }
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

    console.log("=== QUEUE DEBUG ===");
    console.log("Setting queue with results:", results.length, "songs");
    console.log("Playing song:", song.title, "with ID:", song.id);
    console.log("Song exists in results:", results.some(r => r.id === song.id));
    
    // S'assurer que la queue contient tous les résultats
    setQueue(results);
    
    // Vérifier que la chanson est bien dans les résultats
    const songInResults = results.find(r => r.id === song.id);
    if (!songInResults) {
      console.error("Song not found in results, adding it");
      const updatedResults = [song, ...results];
      setQueue(updatedResults);
    }
    
    console.log("==================");
    
    play(song);
  };

  const handlePlaylistClick = (playlist: any) => {
    navigate(`/playlist/${playlist.id}`);
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

  const viewArtistProfile = async (artistName: string) => {
    if (!artistName || artistName === "Unknown Artist") {
      toast.error("Nom d'artiste invalide");
      return;
    }

    try {
      toast.info(`Recherche du profil de ${artistName}...`);
      
      // Try to find the artist directly in Deezer
      const artistData = await searchArtist(artistName);
      
      if (artistData && artistData.artist) {
        // Navigate to artist page with the Deezer artist ID
        navigate(`/artist/${artistData.artist.id}`);
      } else {
        // If not found by ID, use the name in the URL
        navigate(`/artist/name/${encodeURIComponent(artistName)}`);
      }
    } catch (error) {
      console.error("Error searching artist:", error);
      toast.error("Erreur lors de la recherche de l'artiste");
    }
  };

  // Handle navigation to synced lyrics page
  const handleLyricsNavigation = useCallback(() => {
    // Just navigate to the synced lyrics page
    navigate("/synced-lyrics");
  }, [navigate]);

  const songCardContextMenu = (song: any) => [
    {
      label: "Voir le profil de l'artiste",
      icon: <User className="h-4 w-4" />,
      action: () => viewArtistProfile(song.artist),
      show: !!song.artist && song.artist !== "Unknown Artist"
    }
  ];

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
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1 group">
                <SearchIcon className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 transition-all duration-300",
                  "group-focus-within:text-primary group-hover:text-primary",
                  "group-focus-within:scale-110 group-hover:scale-110"
                )} />
                <Input
                  type="text"
                  placeholder={
                    searchFilter === "playlist" ? "Rechercher une playlist..." :
                    searchFilter === "genre" ? "Sélectionnez un genre..." : 
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

              {searchFilter === "genre" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      <span className="text-sm">
                        {selectedGenre || "Sélectionner un genre"}
                      </span>
                    </Button>
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

            {/* New Tab Filter System */}
            <Tabs 
              value={searchFilter} 
              onValueChange={(value) => {
                setSearchFilter(value as typeof searchFilter);
                setSelectedGenre("");
              }}
              className="w-full mb-6"
            >
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <SearchIcon className="h-4 w-4" />
                  Tout
                </TabsTrigger>
                <TabsTrigger value="title" className="flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  Titre
                </TabsTrigger>
                <TabsTrigger value="artist" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Artiste
                </TabsTrigger>
                <TabsTrigger value="playlist" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Playlist
                </TabsTrigger>
                <TabsTrigger value="genre" className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Genre
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
              </div>
            ) : searchFilter === "playlist" && playlistResults.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Playlists</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playlistResults.map((playlist, index) => (
                    <div
                      key={playlist.id}
                      style={{ 
                        animation: `fadeIn 0.3s ease-out forwards ${index * 50}ms`,
                        opacity: 0,
                      }}
                      onClick={() => handlePlaylistClick(playlist)}
                      className="bg-card border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {playlist.cover_image_url ? (
                          <img 
                            src={playlist.cover_image_url} 
                            alt={playlist.name}
                            className="w-16 h-16 rounded object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                            <List className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{playlist.name}</h4>
                          {playlist.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {playlist.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Créée le {new Date(playlist.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                {results.map((song, index) => {
                  const isFavorite = favorites.some(s => s.id === song.id);
                  const isCurrentSong = currentSong?.id === song.id;
                  
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
                        onLyricsClick={handleLyricsNavigation}
                        onReportClick={() => setSongToReport(song)}
                        contextMenuItems={songCardContextMenu(song)}
                      />
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
                Commencez à taper pour rechercher des chansons ou utilisez "*" pour tout afficher...
              </div>
            )}
          </div>
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
