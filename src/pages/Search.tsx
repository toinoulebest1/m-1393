import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/utils/dateUtils";
import { searchTidalTracks } from '@/services/tidalService';
import { useInstantPlayback } from "@/hooks/useInstantPlayback";

const GENRES = ["Pop", "Rock", "Hip-Hop", "Jazz", "Électronique", "Classique", "R&B", "Folk", "Blues", "Country", "Reggae", "Metal", "Soul", "Funk", "Dance"];

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem('lastSearch') || "";
  });
  const [results, setResults] = useState<any[]>([]);
  const [playlistResults, setPlaylistResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "title" | "artist" | "genre" | "playlist">(() => {
    return localStorage.getItem('lastSearchFilter') as "all" | "title" | "artist" | "genre" | "playlist" || "all";
  });
  const [selectedGenre, setSelectedGenre] = useState(() => {
    return localStorage.getItem('lastSelectedGenre') || "";
  });
  const [songToReport, setSongToReport] = useState<any>(null);
  const {
    play,
    setQueue,
    currentSong,
    favorites,
    isPlaying,
    pause
  } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Lance le préchargement des URLs dès que les résultats de recherche sont disponibles
  useInstantPlayback(results, !isLoading && results.length > 0);

  useEffect(() => {
    const scrollKey = `scroll-${location.pathname}`;
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll !== null) {
      const restoreScroll = () => {
        const scrollPos = parseInt(savedScroll, 10);
        window.scrollTo(0, scrollPos);
        sessionStorage.removeItem(scrollKey);
      };
      setTimeout(restoreScroll, 0);
      setTimeout(restoreScroll, 100);
      setTimeout(restoreScroll, 300);
    }
  }, [location.pathname]);

  useEffect(() => {
    const savedSearch = localStorage.getItem('lastSearch');
    if (savedSearch && savedSearch.trim()) {
      handleSearch(savedSearch);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lastSearchFilter', searchFilter);
    if (searchQuery) {
      handleSearch(searchQuery);
    }
  }, [searchFilter]);

  useEffect(() => {
    localStorage.setItem('lastSelectedGenre', selectedGenre);
  }, [selectedGenre]);

  useEffect(() => {
    try {
      localStorage.setItem('lastSearchResults', JSON.stringify(results || []));
    } catch (e) {
      console.warn('Failed to persist lastSearchResults', e);
    }
  }, [results]);

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
      const { data: { user } } = await supabase.auth.getUser();

      if (searchFilter === "playlist") {
        let playlistQuery = supabase.from('playlists').select('*');
        if (!isWildcardSearch) {
          playlistQuery = playlistQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
        }
        const { data: playlistData, error: playlistError } = await playlistQuery;
        if (playlistError) throw playlistError;

        const visiblePlaylists = [];
        if (playlistData && user) {
          for (const playlist of playlistData) {
            if (playlist.user_id === user.id) {
              visiblePlaylists.push({ ...playlist, isSharedByFriend: false });
              continue;
            }
            const { data: canView, error: canViewError } = await supabase.rpc('can_view_playlist', {
              playlist_id: playlist.id,
              viewer_user_id: user.id
            });
            if (canViewError) continue;
            if (canView) {
              const { data: ownerProfile } = await supabase.from('profiles').select('username').eq('id', playlist.user_id).single();
              visiblePlaylists.push({ ...playlist, isSharedByFriend: true, profiles: ownerProfile });
            }
          }
        }
        setPlaylistResults(visiblePlaylists);
        setResults([]);
        setIsLoading(false);
        return;
      }

      // --- DUAL SEARCH FOR SONGS (Local + Tidal) ---
      const tidalSongsPromise = searchTidalTracks(query);

      let localSongsPromise;
      let songQuery = supabase.from('songs').select('*');
      if (!isWildcardSearch) {
        if (searchFilter === "all") {
          songQuery = songQuery.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
        } else if (searchFilter === "title") {
          songQuery = songQuery.ilike('title', `%${query}%`);
        } else if (searchFilter === "artist") {
          songQuery = songQuery.ilike('artist', `%${query}%`);
        }
      } else {
        songQuery = songQuery.limit(500);
      }
      localSongsPromise = songQuery;

      const [tidalSongs, localSongsResult] = await Promise.all([tidalSongsPromise, localSongsPromise]);

      if (localSongsResult.error) {
        console.error("Supabase search error:", localSongsResult.error);
      }

      let localSongs = localSongsResult.data || [];
      if (isWildcardSearch && localSongs.length > 0) {
        localSongs = localSongs.sort(() => Math.random() - 0.5).slice(0, 20);
      }

      const uniqueSongs = new Map<string, any>();

      localSongs.forEach(song => {
        const key = `${song.title.toLowerCase().trim()}|${(song.artist || '').toLowerCase().trim()}`;
        uniqueSongs.set(key, {
          id: song.id,
          title: song.title,
          artist: song.artist || '',
          duration: song.duration || '0:00',
          url: song.tidal_id ? `tidal:${song.tidal_id}` : song.file_path,
          imageUrl: song.image_url,
          album_name: song.album_name,
          isLocal: true,
        });
      });

      tidalSongs.forEach(song => {
        const key = `${song.title.toLowerCase().trim()}|${(song.artist || '').toLowerCase().trim()}`;
        if (!uniqueSongs.has(key)) {
          uniqueSongs.set(key, song);
        }
      });

      setResults(Array.from(uniqueSongs.values()));
      setPlaylistResults([]);

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
        // Si on relance la même chanson, on s'assure que la queue est bien la bonne
        const newQueue = [...results];
        setQueue(newQueue);
        play(); // On utilise play() sans argument pour reprendre la lecture
      }
      return;
    }
    const newQueue = [...results];
    setQueue(newQueue);
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

  const handleLyricsNavigation = useCallback(() => {
    sessionStorage.setItem(`scroll-${location.pathname}`, window.scrollY.toString());
    navigate("/synced-lyrics", { state: { from: location.pathname + location.search } });
  }, [navigate, location]);

  const songCardContextMenu = (song: any) => [{
    label: "Voir le profil de l'artiste",
    icon: <User className="h-4 w-4" />,
    action: () => toast.info("La navigation vers les profils d'artistes est désactivée."),
    show: !!song.artist && song.artist !== "Unknown Artist"
  }];

  return (
    <Layout>
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-6xl mx-auto p-8 pb-32">
            <div className="mb-8">
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1 group">
                  <SearchIcon className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 transition-all duration-300", "group-focus-within:text-primary group-hover:text-primary", "group-focus-within:scale-110 group-hover:scale-110")} />
                  <Input
                    type="text"
                    placeholder={searchFilter === "playlist" ? "Rechercher une playlist..." : searchFilter === "genre" ? "Sélectionnez un genre..." : "Rechercher une chanson ou un artiste (ou * pour tout afficher)"}
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    className="pl-10"
                    disabled={searchFilter === "genre"}
                  />
                </div>
                <VoiceSearchButton onVoiceResult={handleVoiceResult} />
                {searchFilter === "genre" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Music className="h-4 w-4" />
                        <span className="text-sm">{selectedGenre || "Sélectionner un genre"}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {GENRES.map(genre => (
                        <DropdownMenuItem key={genre} onClick={() => setSelectedGenre(genre)}>
                          {genre}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <Tabs value={searchFilter} onValueChange={value => {
                setSearchFilter(value as any);
                setSelectedGenre("");
              }} className="w-full mb-6">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="all" className="flex items-center gap-2"><SearchIcon className="h-4 w-4" />Tout</TabsTrigger>
                  <TabsTrigger value="title" className="flex items-center gap-2"><Music className="h-4 w-4" />Titre</TabsTrigger>
                  <TabsTrigger value="artist" className="flex items-center gap-2"><User className="h-4 w-4" />Artiste</TabsTrigger>
                  <TabsTrigger value="playlist" className="flex items-center gap-2"><List className="h-4 w-4" />Playlist</TabsTrigger>
                  <TabsTrigger value="genre" className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Genre</TabsTrigger>
                </TabsList>
              </Tabs>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                </div>
              ) : searchFilter === "playlist" ? (
                playlistResults.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Playlists ({playlistResults.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {playlistResults.map(playlist => (
                        <div key={playlist.id} onClick={() => handlePlaylistClick(playlist)} className="bg-card border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            {playlist.cover_image_url ? <img src={playlist.cover_image_url} alt={playlist.name} className="w-16 h-16 rounded object-cover" /> : <div className="w-16 h-16 rounded bg-muted flex items-center justify-center"><List className="h-8 w-8 text-muted-foreground" /></div>}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{playlist.name}</h4>
                              {playlist.description && <p className="text-sm text-muted-foreground truncate">{playlist.description}</p>}
                              {playlist.isSharedByFriend && playlist.profiles?.username && <p className="text-xs text-blue-400 font-medium">Partagée par {playlist.profiles.username}</p>}
                              <p className="text-xs text-muted-foreground">Mise à jour {formatRelativeTime(playlist.updated_at)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">{searchQuery ? `Aucune playlist trouvée pour "${searchQuery}"` : "Commencez à taper pour rechercher des playlists..."}</div>
                )
              ) : (results.length > 0 || playlistResults.length > 0) ? (
                <div className="space-y-6">
                  {results.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Chansons ({results.length})</h3>
                      <div className="space-y-2">
                        {results.map(song => {
                          const isFavorite = favorites.some(s => s.id === song.id);
                          const isCurrentSong = currentSong?.id === song.id;
                          return (
                            <div key={song.id} onClick={() => handlePlay(song)}>
                              <SongCard song={song} isCurrentSong={isCurrentSong} isFavorite={isFavorite} dominantColor={dominantColor} onLyricsClick={handleLyricsNavigation} onReportClick={() => setSongToReport(song)} contextMenuItems={songCardContextMenu(song)} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {playlistResults.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Playlists ({playlistResults.length})</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {playlistResults.map(playlist => (
                          <div key={playlist.id} onClick={() => handlePlaylistClick(playlist)} className="border p-4 transition-colors cursor-pointer bg-slate-900 rounded-2xl">
                            <div className="flex items-center gap-3">
                              {playlist.cover_image_url ? <img src={playlist.cover_image_url} alt={playlist.name} className="w-16 h-16 rounded object-cover" /> : <div className="w-16 h-16 rounded bg-muted flex items-center justify-center"><List className="h-8 w-8 text-muted-foreground" /></div>}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{playlist.name}</h4>
                                {playlist.description && <p className="text-sm text-muted-foreground truncate">{playlist.description}</p>}
                                {playlist.isSharedByFriend && playlist.profiles?.username && <p className="text-xs text-blue-400 font-medium">Partagée par {playlist.profiles.username}</p>}
                                <p className="text-xs text-muted-foreground">Mise à jour {formatRelativeTime(playlist.updated_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">{searchQuery ? `Aucun résultat trouvé pour "${searchQuery}"` : 'Commencez à taper pour rechercher des chansons ou utilisez "*" pour tout afficher...'}</div>
              )}
            </div>
          </div>
        </div>
        <Player />
        <ReportSongDialog song={songToReport} onClose={() => setSongToReport(null)} />
      </div>
    </Layout>
  );
};

export default SearchPage;