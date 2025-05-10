import { useState, useEffect, useRef } from "react";
import { Player } from "@/components/Player";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon, Clock, Signal, Heart, Flag, SlidersHorizontal, Music, Mic, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ColorThief from 'colorthief';
import { ReportSongDialog } from "@/components/ReportSongDialog";
import { LyricsModal } from "@/components/LyricsModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "title" | "artist" | "genre">(() => {
    return (localStorage.getItem('lastSearchFilter') as "all" | "title" | "artist" | "genre") || "all";
  });
  const [selectedGenre, setSelectedGenre] = useState(() => {
    return localStorage.getItem('lastSelectedGenre') || "";
  });
  const [songToReport, setSongToReport] = useState<any>(null);
  const [songToShowLyrics, setSongToShowLyrics] = useState<any>(null);
  const { play, setQueue, queue, currentSong, favorites, toggleFavorite, isPlaying, pause } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    localStorage.setItem('lastSearchFilter', searchFilter);
  }, [searchFilter]);

  useEffect(() => {
    localStorage.setItem('lastSelectedGenre', selectedGenre);
  }, [selectedGenre]);

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
    localStorage.setItem('lastSearch', query);
    
    const isWildcardSearch = query === "*";
    
    if (!isWildcardSearch && query.length < 2 && searchFilter !== "genre") {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
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
      
      // For wildcard search or genre filter, we don't need additional filters
      // as we want to get all songs

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
      
      if (isWildcardSearch) {
        toast.success(`Tous les morceaux listés (${formattedResults.length})`);
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

    setQueue([song]);
    
    play(song);
  };

  useEffect(() => {
    if (searchFilter === "genre" && selectedGenre) {
      handleSearch("");
    }
  }, [selectedGenre, searchFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        recognitionRef.current = new SpeechRecognitionAPI();
        if (recognitionRef.current) {
          recognitionRef.current.continuous = false;
          recognitionRef.current.interimResults = false;
          recognitionRef.current.lang = 'fr-FR';

          recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
            const text = event.results[0][0].transcript;
            setSearchQuery(text);
            handleSearch(text);
            toast.success('Recherche vocale effectuée');
            setIsRecording(false);
          };

          recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Erreur de reconnaissance vocale:', event.error);
            toast.error('Erreur lors de la reconnaissance vocale');
            setIsRecording(false);
          };

          recognitionRef.current.onend = () => {
            setIsRecording(false);
          };
        }
      } else {
        toast.error('La reconnaissance vocale n\'est pas supportée par votre navigateur');
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error('La reconnaissance vocale n\'est pas supportée');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      toast.info('Arrêt de l\'enregistrement...');
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      toast.info('Enregistrement en cours...');
    }
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
                  placeholder={searchFilter === "genre" ? "Sélectionnez un genre..." : "Rechercher une chanson ou un artiste (ou * pour tout afficher)"}
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

              <Button
                variant="voice"
                size="icon"
                className={cn(
                  "relative w-10 h-10 rounded-full overflow-hidden transition-all duration-500",
                  "bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 bg-[length:200%_200%]",
                  "before:absolute before:inset-0 before:rounded-full before:bg-black/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
                  isRecording ? [
                    "animate-[glow_1.5s_ease-in-out_infinite]",
                    "bg-gradient-to-r from-red-500 via-pink-500 to-red-500",
                    "scale-110"
                  ] : "hover:scale-105 hover:rotate-3",
                )}
                onClick={toggleRecording}
                aria-label={isRecording ? "Arrêter l'enregistrement" : "Commencer l'enregistrement"}
              >
                <div className="relative z-10 flex items-center justify-center w-full h-full">
                  <Mic className={cn(
                    "h-5 w-5 transition-all duration-300",
                    isRecording ? "text-white animate-[wave_1s_ease-in-out_infinite] scale-110" : "text-white"
                  )} />
                </div>
                
                {isRecording && (
                  <>
                    <span className="absolute inset-0 border-4 border-white/30 rounded-full animate-[spin_3s_linear_infinite]" />
                    <span className="absolute inset-0 animate-[ripple_1.5s_linear_infinite]" 
                          style={{
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderRadius: '100%'
                          }}
                    />
                    <span className="absolute inset-0 animate-[ripple_1.5s_linear_infinite_0.5s]" 
                          style={{
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderRadius: '100%'
                          }}
                    />
                  </>
                )}
              </Button>

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
                    "--glow-shadow": `
                    0 0 10px 5px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.3),
                    0 0 20px 10px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2),
                    0 0 30px 15px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.1)
                  `,
                  } as React.CSSProperties : {};

                  return (
                    <div
                      key={song.id}
                      className={cn(
                        "group flex items-center justify-between p-4 rounded-lg transition-all duration-500 cursor-pointer",
                        isCurrentSong ? "bg-white/5 backdrop-blur-sm" : "hover:bg-white/5",
                        "transform hover:scale-[1.02] hover:-translate-y-0.5 transition-transform duration-300"
                      )}
                      style={{ 
                        animation: `fadeIn 0.3s ease-out forwards ${index * 50}ms`,
                        opacity: 0,
                      }}
                      onClick={() => handlePlay(song)}
                    >
                      {isCurrentSong && (
                        <div className="absolute inset-0 z-0 overflow-hidden rounded-lg">
                          <div 
                            className="absolute inset-0 animate-gradient opacity-20" 
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

                      <div className="relative z-10 flex items-center justify-between w-full group">
                        <div className="flex items-center flex-1">
                          <div 
                            className={cn(
                              "relative overflow-hidden rounded-md transition-transform duration-300",
                              isCurrentSong && "animate-pulse-glow"
                            )}
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
                              "font-medium transform transition-all duration-300",
                              isCurrentSong ? "text-white scale-105" : "text-spotify-neutral group-hover:text-white group-hover:scale-105"
                            )}>
                              {song.title}
                            </h3>
                            <p className={cn(
                              "text-sm transition-all duration-300",
                              isCurrentSong ? "text-white/80" : "text-spotify-neutral group-hover:text-white/80"
                            )}>
                              {song.artist}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-6">
                          <div className={cn(
                            "flex items-center space-x-1",
                            isCurrentSong ? "text-white/80" : "text-spotify-neutral group-hover:text-white/80"
                          )}>
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">{song.duration || "0:00"}</span>
                          </div>

                          <div className={cn(
                            "flex items-center space-x-1",
                            isCurrentSong ? "text-white/80" : "text-spotify-neutral group-hover:text-white/80"
                          )}>
                            <Signal className="w-4 h-4" />
                            <span className="text-sm">{song.bitrate || "320 kbps"}</span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(song);
                              }}
                              className="p-2 hover:bg-white/5 rounded-full transition-all duration-300"
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
                                setSongToShowLyrics(song);
                              }}
                              className="p-2 hover:bg-white/5 rounded-full transition-all duration-300"
                            >
                              <FileText className="w-5 h-5 text-spotify-neutral hover:text-white transition-all duration-300 hover:scale-110" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSongToReport(song);
                              }}
                              className="p-2 hover:bg-white/5 rounded-full transition-all duration-300"
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
      {songToShowLyrics && (
        <LyricsModal
          isOpen={!!songToShowLyrics}
          onClose={() => setSongToShowLyrics(null)}
          songId={songToShowLyrics.id}
          songTitle={songToShowLyrics.title}
          artist={songToShowLyrics.artist}
        />
      )}
    </div>
  );
};

export default Search;
