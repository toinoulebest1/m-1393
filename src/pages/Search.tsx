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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { searchArtist } from "@/services/deezerApi";
import { formatRelativeTime } from "@/utils/dateUtils";
const GENRES = ["Pop", "Rock", "Hip-Hop", "Jazz", "Électronique", "Classique", "R&B", "Folk", "Blues", "Country", "Reggae", "Metal", "Soul", "Funk", "Dance"];
const Search = () => {
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
    queue,
    currentSong,
    favorites,
    toggleFavorite,
    isPlaying,
    pause
  } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Préchargement désactivé sur demande de l'utilisateur
  // useInstantPlayback(results);
  
  // Restaurer la position de scroll au retour
  useEffect(() => {
    const scrollKey = `scroll-${location.pathname}`;
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll !== null) {
      // Attendre que le DOM soit complètement chargé
      const restoreScroll = () => {
        const scrollPos = parseInt(savedScroll, 10);
        window.scrollTo(0, scrollPos);
        sessionStorage.removeItem(scrollKey);
      };
      
      // Utiliser plusieurs tentatives pour s'assurer que le contenu est chargé
      setTimeout(restoreScroll, 0);
      setTimeout(restoreScroll, 100);
      setTimeout(restoreScroll, 300);
    }
  }, [location.pathname]);
  
  // Trigger saved search on component mount
  useEffect(() => {
    const savedSearch = localStorage.getItem('lastSearch');
    if (savedSearch && savedSearch.trim()) {
      handleSearch(savedSearch);
    }
  }, []); // Run only once on mount

  // Handle filter changes
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
  
  // Sauvegarder les derniers résultats de recherche pour la navigation suivante/précédente
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
      // Get current user first
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      
      console.log("=== SEARCH DEBUG ===");
      console.log("Current user:", user);
      console.log("User ID:", user?.id);
      console.log("Search filter:", searchFilter);
      console.log("Search query:", query);
      console.log("Is wildcard search:", isWildcardSearch);
      
      // For song searches, we don't need to require authentication
      // Only playlist searches require authentication
      if (!user && searchFilter === "playlist") {
        console.log("No user found, cannot search for playlists");
        setResults([]);
        setPlaylistResults([]);
        setIsLoading(false);
        return;
      }
      console.log("=== PLAYLIST SEARCH DEBUG ===");
      console.log("Current user ID:", user?.id);
      console.log("Search filter:", searchFilter);
      console.log("Search query:", query);
      if (searchFilter === "playlist") {
        // Search in playlists only - first get playlists, then get owner info separately
        let playlistQuery = supabase.from('playlists').select('*');
        if (!isWildcardSearch) {
          playlistQuery = playlistQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
        }
        const {
          data: playlistData,
          error: playlistError
        } = await playlistQuery;
        console.log("Raw playlist data:", playlistData);
        console.log("Playlist error:", playlistError);
        if (playlistError) {
          throw playlistError;
        }

        // Filter playlists that the current user can view (only if user is authenticated)
        const visiblePlaylists = [];
        if (playlistData && user) {
          console.log("Checking visibility for", playlistData.length, "playlists");
          for (const playlist of playlistData) {
            console.log(`Checking playlist: ${playlist.name} (owner: ${playlist.user_id})`);

            // Check if user is owner
            if (playlist.user_id === user.id) {
              console.log("User is owner, adding playlist");
              visiblePlaylists.push({
                ...playlist,
                isSharedByFriend: false
              });
              continue;
            }

            // Check if user can view the playlist
            try {
              const {
                data: canView,
                error: canViewError
              } = await supabase.rpc('can_view_playlist', {
                playlist_id: playlist.id,
                viewer_user_id: user.id
              });
              console.log(`Can view playlist ${playlist.name}:`, canView, "Error:", canViewError);
              if (canViewError) {
                console.error("Error checking playlist visibility:", canViewError);
                continue;
              }
              if (canView) {
                console.log("User can view playlist, adding as shared");
                // Get owner username for shared playlists
                const {
                  data: ownerProfile
                } = await supabase.from('profiles').select('username').eq('id', playlist.user_id).single();
                visiblePlaylists.push({
                  ...playlist,
                  isSharedByFriend: true,
                  profiles: ownerProfile
                });
              }
            } catch (error) {
              console.error("Error in can_view_playlist RPC:", error);
            }
          }
        }
        console.log("Final visible playlists:", visiblePlaylists);
        setPlaylistResults(visiblePlaylists);
        setResults([]);
      } else if (searchFilter === "all") {
        // Search in both songs and playlists
        const promises = [];

        // Search songs
        let songQuery = supabase.from('songs').select('*');
        if (!isWildcardSearch) {
          songQuery = songQuery.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
        } else {
          // Pour wildcard, récupérer TOUTES les musiques (limite haute)
          songQuery = songQuery.limit(500);
        }
        console.log("Song query built for search filter 'all'");
        promises.push(songQuery);

        // Search playlists - first get playlists, then get owner info separately
        let playlistQuery = supabase.from('playlists').select('*');
        if (!isWildcardSearch) {
          playlistQuery = playlistQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
        }
        promises.push(playlistQuery);
        
        const [songResult, playlistResult] = await Promise.all(promises);
        
        // Search on Deezer separately
        let deezerResult = null;
        if (query.trim()) {
          if (isWildcardSearch) {
            // Pour *, faire 3 requêtes parallèles optimisées
            const requests = [];
            for (let i = 0; i < 3; i++) {
              requests.push(
                supabase.functions.invoke('deezer-search', {
                  body: { query: "a", limit: 50, index: i * 50 }
                })
              );
            }
            
            const allResults = await Promise.all(requests);
            const allTracks = allResults
              .filter(r => !r.error && r.data?.data)
              .flatMap(r => r.data.data);
            
            deezerResult = { data: { data: allTracks } };
            console.log(`✅ Récupéré ${allTracks.length} musiques Deezer pour la recherche wildcard`);
          } else {
            deezerResult = await supabase.functions.invoke('deezer-search', {
              body: { query, limit: 50 }
            });
          }
        }
        
        console.log("Song query result:", songResult);
        console.log("Song data length:", songResult.data?.length);
        console.log("Song error:", songResult.error);
        
        if (songResult.error) {
          throw songResult.error;
        }
        if (playlistResult.error) {
          throw playlistResult.error;
        }
        
        // Mélanger et sélectionner aléatoirement si recherche wildcard
        let localSongs = songResult.data || [];
        if (isWildcardSearch && localSongs.length > 0) {
          // Mélanger toutes les musiques puis en prendre 20 au hasard
          localSongs = localSongs
            .sort(() => Math.random() - 0.5)
            .slice(0, 20);
        }
        
        const formattedResults = localSongs.map(song => ({
          id: song.id,
          title: song.title,
          artist: song.artist || '',
          duration: song.duration || '0:00',
          url: song.file_path,
          imageUrl: song.image_url,
          bitrate: '320 kbps',
          genre: song.genre,
          album_name: song.album_name,
          deezer_id: song.deezer_id,
          tidal_id: song.tidal_id,
          isLocal: true
        }));

        // Add Deezer results
        if (deezerResult && !deezerResult.error && deezerResult.data?.data) {
          const deezerSongs = deezerResult.data.data.map((track: any) => {
            // Tenter d'utiliser les contributeurs retournés par l'API (enrichis côté Edge)
            let names: string[] = [];
            if (Array.isArray(track._contributors_names) && track._contributors_names.length > 0) {
              names = track._contributors_names;
            } else if (Array.isArray(track.contributors) && track.contributors.length > 0) {
              names = track.contributors.map((c: any) => c?.name).filter(Boolean);
              const main = track.artist?.name;
              if (main && !names.includes(main)) names.unshift(main);
            } else if (track.artist?.name) {
              names = [track.artist.name];
            }

            // Extraire aussi depuis le titre (feat/ft)
            if (track.title) {
              const featMatch = track.title.match(/\(feat\.?\s+([^)]+)\)|\(ft\.?\s+([^)]+)\)/i);
              if (featMatch) {
                const featArtist = (featMatch[1] || featMatch[2] || '').split(/,|&|\band\b/i).map((s: string) => s.trim()).filter(Boolean);
                names.push(...featArtist);
              }
            }

            // Dédupliquer et joindre
            const artistName = Array.from(new Set(names.filter(Boolean))).join(' & ');
            
            return {
              id: `deezer-${track.id}`,
              title: track.title,
              artist: artistName || track.artist?.name || '',
              duration: Math.floor(track.duration / 60) + ':' + String(track.duration % 60).padStart(2, '0'),
              url: track.preview,
              imageUrl: track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium,
              bitrate: 'Preview',
              album_name: track.album?.title,
              isDeezer: true
            };
          });
          formattedResults.push(...deezerSongs);
        }

        // Dédupliquer les résultats par ID ET par titre+artiste normalisé
        const uniqueMap = new Map();
        const seenTitleArtist = new Set();
        
        formattedResults.forEach(song => {
          const normalizedKey = `${song.title.toLowerCase().trim()}_${song.artist.toLowerCase().trim()}`;
          
          // Si on n'a pas encore vu cette combinaison titre+artiste
          if (!seenTitleArtist.has(normalizedKey)) {
            uniqueMap.set(song.id, song);
            seenTitleArtist.add(normalizedKey);
          } else {
            // Si on a déjà vu cette combinaison, garder la version locale si possible
            const existingSong = Array.from(uniqueMap.values()).find(
              s => `${s.title.toLowerCase().trim()}_${s.artist.toLowerCase().trim()}` === normalizedKey
            );
            if (existingSong && !existingSong.isLocal && song.isLocal) {
              // Remplacer la version Deezer par la version locale
              uniqueMap.delete(existingSong.id);
              uniqueMap.set(song.id, song);
            }
          }
        });
        
        const uniqueResults = Array.from(uniqueMap.values());

        // Filter playlists that the current user can view (only if user is authenticated)
        const visiblePlaylists = [];
        if (playlistResult.data && user) {
          for (const playlist of playlistResult.data) {
            // Check if user is owner
            if (playlist.user_id === user.id) {
              visiblePlaylists.push({
                ...playlist,
                isSharedByFriend: false
              });
              continue;
            }

            // Check if user can view the playlist
            try {
              const {
                data: canView,
                error: canViewError
              } = await supabase.rpc('can_view_playlist', {
                playlist_id: playlist.id,
                viewer_user_id: user.id
              });
              if (canViewError) {
                console.error("Error checking playlist visibility:", canViewError);
                continue;
              }
              if (canView) {
                // Get owner username for shared playlists
                const {
                  data: ownerProfile
                } = await supabase.from('profiles').select('username').eq('id', playlist.user_id).single();
                visiblePlaylists.push({
                  ...playlist,
                  isSharedByFriend: true,
                  profiles: ownerProfile
                });
              }
            } catch (error) {
              console.error("Error in can_view_playlist RPC:", error);
            }
          }
        }
        setResults(uniqueResults);
        setPlaylistResults(visiblePlaylists);
      } else {
        // Search in songs only for title, artist, genre filters
        let queryBuilder = supabase.from('songs').select('*');
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
        } else {
          // Pour wildcard, récupérer TOUTES les musiques (limite haute)
          queryBuilder = queryBuilder.limit(500);
        }
        
        const {
          data,
          error
        } = await queryBuilder;
        
        if (error) {
          throw error;
        }
        
        // Also search Deezer for non-genre filters
        let deezerResult = null;
        if (searchFilter !== "genre" && query.trim()) {
          if (isWildcardSearch) {
            // Pour *, faire 3 requêtes parallèles optimisées
            const requests = [];
            for (let i = 0; i < 3; i++) {
              requests.push(
                supabase.functions.invoke('deezer-search', {
                  body: { query: "a", limit: 50, index: i * 50 }
                })
              );
            }
            
            const allResults = await Promise.all(requests);
            const allTracks = allResults
              .filter(r => !r.error && r.data?.data)
              .flatMap(r => r.data.data);
            
            deezerResult = { data: { data: allTracks } };
            console.log(`✅ Récupéré ${allTracks.length} musiques Deezer pour la recherche wildcard`);
          } else {
            deezerResult = await supabase.functions.invoke('deezer-search', {
              body: { query, limit: 50 }
            });
          }
        }
        
        // Mélanger et sélectionner aléatoirement si recherche wildcard
        let songs = data || [];
        if (isWildcardSearch && songs.length > 0) {
          // Mélanger toutes les musiques puis en prendre 20 au hasard
          songs = songs
            .sort(() => Math.random() - 0.5)
            .slice(0, 20);
        }
        
        const formattedResults = songs.map(song => ({
          id: song.id,
          title: song.title,
          artist: song.artist || '',
          duration: song.duration || '0:00',
          url: song.file_path,
          imageUrl: song.image_url,
          bitrate: '320 kbps',
          genre: song.genre,
          album_name: song.album_name,
          deezer_id: song.deezer_id,
          tidal_id: song.tidal_id,
          isLocal: true
        }));
        
        // Add Deezer results
        if (deezerResult && !deezerResult.error && deezerResult.data?.data) {
          const deezerSongs = deezerResult.data.data.map((track: any) => {
            // Tenter d'utiliser les contributeurs retournés par l'API (enrichis côté Edge)
            let names: string[] = [];
            if (Array.isArray(track._contributors_names) && track._contributors_names.length > 0) {
              names = track._contributors_names;
            } else if (Array.isArray(track.contributors) && track.contributors.length > 0) {
              names = track.contributors.map((c: any) => c?.name).filter(Boolean);
              const main = track.artist?.name;
              if (main && !names.includes(main)) names.unshift(main);
            } else if (track.artist?.name) {
              names = [track.artist.name];
            }

            // Extraire aussi depuis le titre (feat/ft)
            if (track.title) {
              const featMatch = track.title.match(/\(feat\.?\s+([^)]+)\)|\(ft\.?\s+([^)]+)\)/i);
              if (featMatch) {
                const featArtist = (featMatch[1] || featMatch[2] || '').split(/,|&|\band\b/i).map((s: string) => s.trim()).filter(Boolean);
                names.push(...featArtist);
              }
            }

            // Dédupliquer et joindre
            const artistName = Array.from(new Set(names.filter(Boolean))).join(' & ');
            
            return {
              id: `deezer-${track.id}`,
              title: track.title,
              artist: artistName || track.artist?.name || '',
              duration: Math.floor(track.duration / 60) + ':' + String(track.duration % 60).padStart(2, '0'),
              url: track.preview,
              imageUrl: track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium,
              bitrate: 'Preview',
              album_name: track.album?.title,
              isDeezer: true
            };
          });
          formattedResults.push(...deezerSongs);
        }
        
        // Dédupliquer les résultats par ID ET par titre+artiste normalisé
        const uniqueMap = new Map();
        const seenTitleArtist = new Set();
        
        formattedResults.forEach(song => {
          const normalizedKey = `${song.title.toLowerCase().trim()}_${song.artist.toLowerCase().trim()}`;
          
          // Si on n'a pas encore vu cette combinaison titre+artiste
          if (!seenTitleArtist.has(normalizedKey)) {
            uniqueMap.set(song.id, song);
            seenTitleArtist.add(normalizedKey);
          } else {
            // Si on a déjà vu cette combinaison, garder la version locale si possible
            const existingSong = Array.from(uniqueMap.values()).find(
              s => `${s.title.toLowerCase().trim()}_${s.artist.toLowerCase().trim()}` === normalizedKey
            );
            if (existingSong && !existingSong.isLocal && song.isLocal) {
              // Remplacer la version Deezer par la version locale
              uniqueMap.delete(existingSong.id);
              uniqueMap.set(song.id, song);
            }
          }
        });
        
        const uniqueResults = Array.from(uniqueMap.values());
        
        setResults(uniqueResults);
        setPlaylistResults([]);
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
    
    console.log("=== SEARCH QUEUE DEBUG ===");
    console.log("Setting queue with results:", results.length, "songs");
    console.log("Playing song:", song.title, "with ID:", song.id);
    console.log("Song index in results:", results.findIndex(r => r.id === song.id));
    console.log("Current results:", results.map((r, idx) => `${idx}: ${r.title} - ${r.artist} (${r.id})`));
    
    // Mettre la nouvelle queue avec tous les résultats
    const newQueue = [...results];
    console.log("New queue created with", newQueue.length, "songs");
    
    // Sauvegarder immédiatement dans localStorage pour que nextSong puisse y accéder
    localStorage.setItem('queue', JSON.stringify(newQueue));
    
    // Mettre à jour le state
    setQueue(newQueue);
    
    // Jouer la chanson (elle utilisera la queue depuis localStorage si besoin)
    console.log("Playing song:", song.title);
    play(song);
    
    console.log("=====================");
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
    // Sauvegarder la position de scroll
    sessionStorage.setItem(`scroll-${location.pathname}`, window.scrollY.toString());
    // Just navigate to the synced lyrics page
    navigate("/synced-lyrics", { state: { from: location.pathname + location.search } });
  }, [navigate, location]);
  const songCardContextMenu = (song: any) => [{
    label: "Voir le profil de l'artiste",
    icon: <User className="h-4 w-4" />,
    action: () => viewArtistProfile(song.artist),
    show: !!song.artist && song.artist !== "Unknown Artist"
  }];
  return <Layout>
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
                  <SearchIcon className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 transition-all duration-300", "group-focus-within:text-primary group-hover:text-primary", "group-focus-within:scale-110 group-hover:scale-110")} />
                  <Input type="text" placeholder={searchFilter === "playlist" ? "Rechercher une playlist..." : searchFilter === "genre" ? "Sélectionnez un genre..." : "Rechercher une chanson ou un artiste (ou * pour tout afficher)"} value={searchQuery} onChange={e => handleSearch(e.target.value)} className={cn("pl-10 transition-all duration-300", "border-2 focus:border-primary", "shadow-sm hover:shadow-md focus:shadow-lg", "transform-gpu", "text-foreground", "bg-gradient-to-r from-transparent via-transparent to-transparent", "hover:bg-gradient-to-r hover:from-purple-50 hover:via-indigo-50 hover:to-purple-50", "focus:bg-gradient-to-r focus:from-purple-50 focus:via-indigo-50 focus:to-purple-50", "dark:hover:from-purple-900/10 dark:hover:via-indigo-900/10 dark:hover:to-purple-900/10", "dark:focus:from-purple-900/10 dark:focus:via-indigo-900/10 dark:focus:to-purple-900/10")} style={{
                  backgroundSize: '200% 100%'
                }} onFocus={e => {
                  e.target.style.backgroundPosition = '100% 0';
                }} onBlur={e => {
                  e.target.style.backgroundPosition = '0 0';
                }} disabled={searchFilter === "genre"} />
                  <div className={cn("absolute inset-0 pointer-events-none", "opacity-0 group-focus-within:opacity-100", "transition-all duration-500", "rounded-md", "bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10", "animate-gradient", "group-focus-within:animate-[glow_1.5s_ease-in-out_infinite]")} />
                </div>

                <VoiceSearchButton onVoiceResult={handleVoiceResult} />

                {searchFilter === "genre" && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Music className="h-4 w-4" />
                        <span className="text-sm">
                          {selectedGenre || "Sélectionner un genre"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {GENRES.map(genre => <DropdownMenuItem key={genre} onClick={() => setSelectedGenre(genre)}>
                          {genre}
                        </DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>}
              </div>

              {/* New Tab Filter System */}
              <Tabs value={searchFilter} onValueChange={value => {
              setSearchFilter(value as typeof searchFilter);
              setSelectedGenre("");
            }} className="w-full mb-6">
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

              {isLoading ? <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                </div> : searchFilter === "playlist" ?
            // Show only playlists for playlist filter
            playlistResults.length > 0 ? <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Playlists ({playlistResults.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {playlistResults.map((playlist, index) => <div key={playlist.id} onClick={() => handlePlaylistClick(playlist)} className="bg-card border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            {playlist.cover_image_url ? <img src={playlist.cover_image_url} alt={playlist.name} className="w-16 h-16 rounded object-cover" /> : <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                                <List className="h-8 w-8 text-muted-foreground" />
                              </div>}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{playlist.name}</h4>
                              {playlist.description && <p className="text-sm text-muted-foreground truncate">
                                  {playlist.description}
                                </p>}
                              {playlist.isSharedByFriend && playlist.profiles?.username && <p className="text-xs text-blue-400 font-medium">
                                  Partagée par {playlist.profiles.username}
                                </p>}
                              <p className="text-xs text-muted-foreground">
                                Mise à jour {formatRelativeTime(playlist.updated_at)}
                              </p>
                            </div>
                          </div>
                        </div>)}
                    </div>
                  </div> : searchQuery ? <div className="text-center py-12 text-muted-foreground">
                    Aucune playlist trouvée pour "{searchQuery}"
                  </div> : <div className="text-center py-12 text-muted-foreground">
                    Commencez à taper pour rechercher des playlists...
                  </div> : searchFilter === "all" && (results.length > 0 || playlistResults.length > 0) ?
            // Show both songs and playlists for "all" filter
            <div className="space-y-6">
                  {results.length > 0 && <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Chansons ({results.length})</h3>
            <div className="space-y-2">
                  {results.map((song, index) => {
                const isFavorite = favorites.some(s => s.id === song.id);
                // Compare by ID or by normalized title+artist for deduplication compatibility
                const isCurrentSong = currentSong && (
                  currentSong.id === song.id || 
                  (currentSong.title.toLowerCase().trim() === song.title.toLowerCase().trim() && 
                   currentSong.artist.toLowerCase().trim() === song.artist.toLowerCase().trim())
                );
                return <div key={song.id} onClick={() => handlePlay(song)}>
                        <SongCard song={song} isCurrentSong={isCurrentSong} isFavorite={isFavorite} dominantColor={dominantColor} onLyricsClick={handleLyricsNavigation} onReportClick={() => setSongToReport(song)} contextMenuItems={songCardContextMenu(song)} />
                      </div>;
              })}
                </div>
                    </div>}
                  
                  {playlistResults.length > 0 && <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Playlists ({playlistResults.length})</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {playlistResults.map((playlist, index) => <div key={playlist.id} onClick={() => handlePlaylistClick(playlist)} className="border p-4 transition-colors cursor-pointer bg-slate-900 rounded-2xl">
                            <div className="flex items-center gap-3">
                              {playlist.cover_image_url ? <img src={playlist.cover_image_url} alt={playlist.name} className="w-16 h-16 rounded object-cover" /> : <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                                  <List className="h-8 w-8 text-muted-foreground" />
                                </div>}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{playlist.name}</h4>
                                {playlist.description && <p className="text-sm text-muted-foreground truncate">
                                    {playlist.description}
                                  </p>}
                                {playlist.isSharedByFriend && playlist.profiles?.username && <p className="text-xs text-blue-400 font-medium">
                                    Partagée par {playlist.profiles.username}
                                  </p>}
                                <p className="text-xs text-muted-foreground">
                                  Mise à jour {formatRelativeTime(playlist.updated_at)}
                                </p>
                              </div>
                            </div>
                          </div>)}
                </div>
                     </div>}
                </div> : results.length > 0 ?
            // Show only songs for other filters
            <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-2">{results.length} morceau{results.length > 1 ? 'x' : ''}</div>
                  <div className="space-y-2">
                   {results.map((song, index) => {
                const isFavorite = favorites.some(s => s.id === song.id);
                // Compare by ID or by normalized title+artist for deduplication compatibility
                const isCurrentSong = currentSong && (
                  currentSong.id === song.id || 
                  (currentSong.title.toLowerCase().trim() === song.title.toLowerCase().trim() && 
                   currentSong.artist.toLowerCase().trim() === song.artist.toLowerCase().trim())
                );
                return <div key={song.id} onClick={() => handlePlay(song)}>
                        <SongCard song={song} isCurrentSong={isCurrentSong} isFavorite={isFavorite} dominantColor={dominantColor} onLyricsClick={handleLyricsNavigation} onReportClick={() => setSongToReport(song)} contextMenuItems={songCardContextMenu(song)} />
                      </div>;
              })}
                </div>
                </div> : searchQuery ? <div className="text-center py-12 text-muted-foreground">
                  Aucun résultat trouvé pour "{searchQuery}"
                </div> : <div className="text-center py-12 text-muted-foreground">
                  Commencez à taper pour rechercher des chansons ou utilisez "*" pour tout afficher...
                </div>}
            </div>
          </div>
        </div>
        <Player />
        <ReportSongDialog song={songToReport} onClose={() => setSongToReport(null)} />
      </div>
    </Layout>;
};
export default Search;