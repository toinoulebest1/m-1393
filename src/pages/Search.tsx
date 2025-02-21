import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { Search as SearchIcon, Clock, Signal, Heart, Flag, SlidersHorizontal, Music, Mic } from "lucide-react";
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
    <div className="flex min-h-screen relative">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 pb-32">
        <div className="w-full">
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

              <Button
                variant="voice"
                size="icon"
                className={cn(
                  "relative w-10 h-10 rounded-full overflow-hidden",
                  isRecording && [
                    "animate-pulse",
                    "before:absolute before:inset-0 before:bg-red-500/20 before:animate-ping",
                    "after:absolute after:inset-0 after:bg-red-500/40 after:animate-pulse",
                  ]
                )}
                onClick={toggleRecording}
                aria-label={isRecording ? "Arrêter l'enregistrement" : "Commencer l'enregistrement"}
              >
                <Mic className={cn(
                  "h-5 w-5 transition-all duration-300",
                  isRecording && "text-red-500 animate-bounce"
                )} />
                {isRecording && (
                  <span className="absolute inset-0 border-4 border-red-500 rounded-full animate-[spin_3s_linear_infinite]" />
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
                Commencez à taper pour rechercher des chansons...
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
