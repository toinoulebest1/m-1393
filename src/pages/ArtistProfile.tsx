import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { searchArtist, getArtistById, ArtistProfileResponse } from "@/services/deezerApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Player } from "@/components/Player";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Play, Music, Disc, User, Heart, Award, 
  Calendar, ExternalLink, PlayCircle, Clock, Share2,
  Radio, Link, Globe, Info, Pause
} from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { extractDominantColor, rgbToHex } from "@/utils/colorExtractor";
import { Song } from "@/types/player";

const ArtistProfile = () => {
  const { artistId, artistName } = useParams();
  const [profileData, setProfileData] = useState<ArtistProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('top');
  const [availableSongs, setAvailableSongs] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { play, currentSong, isPlaying, pause } = usePlayer();
  const headerRef = useRef<HTMLDivElement>(null);
  const [scrollRatio, setScrollRatio] = useState(0);
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);

  useEffect(() => {
    const fetchArtistData = async () => {
      setLoading(true);
      try {
        let data = null;
        
        if (artistId && !isNaN(parseInt(artistId))) {
          data = await getArtistById(parseInt(artistId));
        } else if (artistName) {
          data = await searchArtist(artistName);
        }
        
        if (data) {
          setProfileData(data);
          document.title = `${data.artist.name} | Profil d'artiste`;
          
          // Extraire la couleur dominante de l'image de l'artiste
          const color = await extractDominantColor(data.artist.picture_xl);
          setDominantColor(color);

          // Vérifier quelles chansons sont disponibles localement
          await checkAvailableSongs(data.artist.name, data.topTracks);
        } else {
          toast.error("Impossible de trouver les informations de l'artiste");
        }
      } catch (error) {
        console.error("Error loading artist:", error);
        toast.error("Erreur lors du chargement du profil de l'artiste");
      } finally {
        setLoading(false);
      }
    };
    
    fetchArtistData();
  }, [artistId, artistName]);

  const checkAvailableSongs = async (artistName: string, tracks: any[]) => {
    try {
      console.log("Checking available songs for artist:", artistName);
      console.log("Tracks to check:", tracks.map(t => t.title));

      const trackTitles = tracks.map(track => track.title.toLowerCase());
      
      const { data: songs, error } = await supabase
        .from('songs')
        .select('title, artist, id, file_path, duration, image_url, genre')
        .ilike('artist', `%${artistName}%`);

      if (error) {
        console.error("Error checking available songs:", error);
        return;
      }

      console.log("Found songs in database:", songs?.map(s => s.title) || []);

      const available = new Set<string>();
      
      songs?.forEach(song => {
        const songTitleLower = song.title.toLowerCase();
        const matchingTrack = tracks.find(track => 
          track.title.toLowerCase() === songTitleLower ||
          track.title.toLowerCase().includes(songTitleLower) ||
          songTitleLower.includes(track.title.toLowerCase())
        );
        
        if (matchingTrack) {
          available.add(matchingTrack.title);
          console.log("Found match:", matchingTrack.title, "->", song.title);
        }
      });

      console.log("Available songs:", Array.from(available));
      setAvailableSongs(available);
    } catch (error) {
      console.error("Error in checkAvailableSongs:", error);
    }
  };

  const handlePlayLocalSong = async (track: any) => {
    try {
      console.log("Playing local song:", track.title);
      
      const { data: songs, error } = await supabase
        .from('songs')
        .select('*')
        .ilike('artist', `%${profileData?.artist.name}%`)
        .ilike('title', `%${track.title}%`)
        .limit(1);

      if (error || !songs || songs.length === 0) {
        console.error("Song not found in database:", error);
        toast.error("Chanson non trouvée dans la base de données");
        return;
      }

      const dbSong = songs[0];
      const localSong: Song = {
        id: dbSong.id,
        title: dbSong.title,
        artist: dbSong.artist,
        duration: dbSong.duration || "3:00",
        url: dbSong.file_path,
        imageUrl: dbSong.image_url || track.album.cover_medium,
        genre: dbSong.genre
      };

      console.log("Playing local song:", localSong);
      await play(localSong);
    } catch (error) {
      console.error("Error playing local song:", error);
      toast.error("Erreur lors de la lecture de la chanson");
    }
  };

  const handlePlayPreview = (preview: string, title: string, artist: string, imageUrl: string) => {
    const previewTrack = {
      id: Math.random().toString(),
      url: preview,
      title: title,
      artist: artist,
      imageUrl: imageUrl,
      duration: '0:30'
    };
    
    play(previewTrack);
  };

  const handlePlayPause = (track: any) => {
    const isCurrentTrack = currentSong?.title === track.title && currentSong?.artist === profileData?.artist.name;
    
    if (isCurrentTrack) {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    } else {
      const isAvailable = availableSongs.has(track.title);
      if (isAvailable) {
        handlePlayLocalSong(track);
      } else {
        handlePlayPreview(track.preview, track.title, track.artist.name, track.album.cover_medium);
      }
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        const scrollPosition = window.scrollY;
        const headerHeight = headerRef.current.offsetHeight;
        const ratio = Math.min(scrollPosition / (headerHeight / 2), 1);
        setScrollRatio(ratio);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const formatFanCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M fans`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K fans`;
    }
    return `${count} fans`;
  };

  const shareArtist = () => {
    if (profileData) {
      if (navigator.share) {
        navigator.share({
          title: `Écoutez ${profileData.artist.name} sur notre app`,
          text: `Découvrez ${profileData.artist.name}, artiste avec ${profileData.artist.nb_fan} fans`,
          url: window.location.href
        })
        .then(() => toast.success("Profil partagé !"))
        .catch((error) => console.log("Erreur de partage:", error));
      } else {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Lien copié dans le presse-papier !");
      }
    }
  };

  const getGlowStyle = () => {
    if (!dominantColor) return {};
    
    const [r, g, b] = dominantColor;
    return {
      boxShadow: `0 0 20px 5px rgba(${r}, ${g}, ${b}, 0.5)`,
      transition: 'box-shadow 0.3s ease-in-out'
    };
  };

  const gradientOpacity = 0.3 + (scrollRatio * 0.7);

  return (
    <div className="w-full min-h-full flex flex-col bg-gradient-to-b from-zinc-900 to-background">
      {/* Floating back button that becomes more visible on scroll */}
      <div 
        className="fixed top-6 left-6 z-10 transition-all duration-300"
        style={{
          opacity: 0.2 + scrollRatio * 0.8,
          transform: `scale(${0.9 + scrollRatio * 0.1})`,
        }}
      >
        <Button 
          variant="outline"
          size="sm"
          className="bg-background/50 backdrop-blur-sm hover:bg-background/70"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto w-full pb-28">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="space-y-6 p-4 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                <Skeleton className="h-64 w-64 rounded-lg" />
                <div className="space-y-4 flex-1">
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
              
              <div>
                <Skeleton className="h-8 w-40 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded" />
                  ))}
                </div>
              </div>
              
              <div>
                <Skeleton className="h-8 w-40 mb-4" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-48 w-full rounded" />
                  ))}
                </div>
              </div>
            </div>
          ) : profileData ? (
            <div className="relative animate-fade-in">
              {/* Hero Header */}
              <div 
                ref={headerRef}
                className="relative h-[60vh] min-h-[400px] w-full flex items-end"
                style={{ 
                  backgroundImage: `url(${profileData.artist.picture_xl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* Gradient overlay sans effet de scintillement */}
                <div 
                  className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"
                  style={{ opacity: gradientOpacity }}
                />
                
                {/* Fixed position, parallax-like cover image */}
                <div className="absolute inset-0 z-0">
                  <div 
                    className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-1"
                  />
                </div>
                
                {/* Artist info container */}
                <div className="relative z-10 w-full px-6 md:px-12 py-8 md:py-12">
                  <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-end gap-8">
                    {/* Artist image avec effet de glow basé sur la couleur dominante */}
                    <div className="relative group">
                      <div 
                        className={`absolute -inset-4 bg-gradient-to-r ${dominantColor ? `from-[rgb(${dominantColor[0]},${dominantColor[1]},${dominantColor[2]})]` : 'from-spotify-accent'} to-purple-600 rounded-xl opacity-40 group-hover:opacity-70 transition duration-300 blur`}
                        style={getGlowStyle()}
                      ></div>
                      <img 
                        src={profileData.artist.picture_xl || '/placeholder.svg'} 
                        alt={profileData.artist.name}
                        className="w-48 h-48 md:w-64 md:h-64 object-cover rounded-lg shadow-2xl transition-transform group-hover:scale-[1.02] relative z-10 animate-scale-in"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4 rounded-lg z-20">
                        <a 
                          href={profileData.artist.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-white flex items-center gap-2 px-4 py-2 bg-spotify-accent rounded-full hover:bg-spotify-accent/90 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Voir sur Deezer
                        </a>
                      </div>
                    </div>
                    
                    {/* Artist info */}
                    <div className="flex-1 mb-2">
                      <div className="animate-fade-in opacity-0" style={{animationDelay: "0.2s", animationFillMode: "forwards"}}>
                        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80 drop-shadow-md">
                          {profileData.artist.name}
                        </h1>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-4 animate-fade-in opacity-0" style={{animationDelay: "0.4s", animationFillMode: "forwards"}}>
                        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
                          <Heart className="h-4 w-4 text-pink-400" />
                          <span>{formatFanCount(profileData.artist.nb_fan)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
                          <Disc className="h-4 w-4 text-spotify-accent" />
                          <span>{profileData.artist.nb_album} albums</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 bg-white/10 backdrop-blur-sm border-white/10 hover:bg-white/20"
                          onClick={shareArtist}
                        >
                          <Share2 className="h-4 w-4" />
                          Partager
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Navigation tabs */}
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'top' | 'albums')}>
                <div className="sticky top-0 z-20 backdrop-blur-md bg-background/70 border-b border-white/10">
                  <div className="max-w-6xl mx-auto px-6 md:px-12">
                    <TabsList className="bg-transparent flex space-x-4 overflow-x-auto scrollbar-none border-b border-white/10 w-full justify-start h-auto p-0 rounded-none">
                      <TabsTrigger 
                        value="top"
                        className={`py-4 px-4 font-medium transition-colors flex items-center gap-2 rounded-none ${
                          activeTab === 'top' 
                            ? 'text-white border-b-2 border-spotify-accent' 
                            : 'text-white/60 hover:text-white border-b-2 border-transparent'
                        }`}
                      >
                        <Award className="h-4 w-4" />
                        Top Titres
                      </TabsTrigger>
                      <TabsTrigger
                        value="albums"
                        className={`py-4 px-4 font-medium transition-colors flex items-center gap-2 rounded-none ${
                          activeTab === 'albums'
                            ? 'text-white border-b-2 border-spotify-accent' 
                            : 'text-white/60 hover:text-white border-b-2 border-transparent'
                        }`}
                      >
                        <Disc className="h-4 w-4" />
                        Albums
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>
              
                {/* Main content with enhanced visual effects for current song */}
                <div className="max-w-6xl mx-auto px-6 md:px-12 py-8">
                  {/* Top Tracks Section */}
                  <TabsContent value="top" className="mt-0">
                    {profileData.topTracks.length > 0 ? (
                      <div className="space-y-4 animate-fade-in">
                        {profileData.topTracks.map((track, index) => {
                          const isAvailable = availableSongs.has(track.title);
                          const isCurrentTrack = currentSong?.title === track.title && currentSong?.artist === profileData?.artist.name;
                          
                          // Style dynamique pour la chanson en cours
                          const currentTrackStyle = isCurrentTrack && dominantColor ? {
                            background: `linear-gradient(to right, rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.3), rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.1))`,
                            borderColor: `rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.5)`,
                            boxShadow: `0 0 20px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.4)`,
                          } : {};
                          
                          return (
                            <Card 
                              key={track.id} 
                              className={cn(
                                "hover:bg-white/5 transition-all duration-300 bg-black/40 border-white/10 overflow-hidden group",
                                isCurrentTrack && "animate-pulse border-spotify-accent/50 shadow-lg"
                              )}
                              style={currentTrackStyle}
                            >
                              <CardContent className="p-0">
                                <div className="flex items-center gap-3 p-3">
                                  <div className="text-sm font-mono text-muted-foreground w-6 text-center flex items-center justify-center">
                                    {isCurrentTrack && isPlaying ? (
                                      <div className="flex gap-1">
                                        <div className="w-1 h-4 bg-spotify-accent animate-bounce" style={{animationDelay: '0ms'}} />
                                        <div className="w-1 h-4 bg-spotify-accent animate-bounce" style={{animationDelay: '150ms'}} />
                                        <div className="w-1 h-4 bg-spotify-accent animate-bounce" style={{animationDelay: '300ms'}} />
                                      </div>
                                    ) : (
                                      <span className={cn(isCurrentTrack && "text-spotify-accent font-bold")}>
                                        {index + 1}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="relative overflow-hidden rounded-md">
                                    <img 
                                      src={track.album.cover_medium} 
                                      alt={track.title}
                                      className={cn(
                                        "h-14 w-14 object-cover transition-transform duration-500",
                                        isCurrentTrack ? "ring-2 ring-spotify-accent animate-pulse" : "group-hover:scale-110"
                                      )}
                                    />
                                    <div className={cn(
                                      "absolute inset-0 bg-gradient-to-t from-black/70 to-transparent transition-opacity flex items-center justify-center",
                                      isCurrentTrack ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                    )}>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        className="h-8 w-8 rounded-full bg-spotify-accent/90 text-white hover:bg-spotify-accent hover:scale-105 transition-transform"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePlayPause(track);
                                        }}
                                      >
                                        {isCurrentTrack && isPlaying ? (
                                          <Pause className="h-4 w-4" />
                                        ) : (
                                          <Play className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <h3 className={cn(
                                      "font-medium truncate transition-colors",
                                      isCurrentTrack 
                                        ? "text-spotify-accent" 
                                        : "text-white group-hover:text-spotify-accent"
                                    )}>
                                      {track.title}
                                      {isCurrentTrack && (
                                        <span className="ml-2 text-xs bg-spotify-accent text-black px-2 py-1 rounded-full animate-pulse">
                                          En cours
                                        </span>
                                      )}
                                    </h3>
                                    <HoverCard>
                                      <HoverCardTrigger>
                                        <p className="text-sm text-white/60 truncate flex items-center gap-2">
                                          <Disc className="h-3 w-3 inline" />
                                          {track.album.title}
                                        </p>
                                      </HoverCardTrigger>
                                      <HoverCardContent className="w-80 bg-background/95 backdrop-blur-lg border-white/20">
                                        <div className="flex space-x-4">
                                          <img 
                                            src={track.album.cover_medium} 
                                            alt={track.album.title}
                                            className="h-24 w-24 object-cover rounded-md"
                                          />
                                          <div>
                                            <h4 className="text-sm font-semibold">{track.album.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Album de {profileData.artist.name}
                                            </p>
                                          </div>
                                        </div>
                                      </HoverCardContent>
                                    </HoverCard>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {isAvailable ? (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePlayPause(track);
                                        }}
                                        className={cn(
                                          "text-xs px-3 py-1 rounded-full transition-all duration-300 font-medium transform hover:scale-105 whitespace-nowrap",
                                          isCurrentTrack 
                                            ? "bg-gradient-to-r from-spotify-accent to-green-600 text-black animate-pulse" 
                                            : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700"
                                        )}
                                      >
                                        {isCurrentTrack && isPlaying ? "En lecture..." : "Disponible Ici"}
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePlayPause(track);
                                        }}
                                        className={cn(
                                          "text-xs px-3 py-1 rounded-full transition-all duration-300 font-medium transform hover:scale-105 whitespace-nowrap",
                                          isCurrentTrack 
                                            ? "bg-gradient-to-r from-spotify-accent to-purple-600 text-black animate-pulse" 
                                            : "bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] text-white hover:from-[#9B87F5] hover:to-[#F97316]"
                                        )}
                                      >
                                        {isCurrentTrack && isPlaying ? "Aperçu actuel" : "Aperçu 30s"}
                                      </button>
                                    )}
                                    <span className="text-xs text-white/40 hidden md:block">
                                      {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                                    </span>
                                    <Button 
                                      size="icon" 
                                      variant="ghost"
                                      className={cn(
                                        "rounded-full transition-colors",
                                        isCurrentTrack 
                                          ? "text-spotify-accent hover:text-white bg-spotify-accent/20" 
                                          : "text-white/80 hover:text-white hover:bg-white/10"
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePlayPause(track);
                                      }}
                                    >
                                      {isCurrentTrack && isPlaying ? (
                                        <Pause className="h-5 w-5" />
                                      ) : (
                                        <PlayCircle className="h-5 w-5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        <Music className="h-16 w-16 mx-auto opacity-30 mb-4" />
                        <h3 className="text-xl font-medium">Aucun top titre disponible</h3>
                        <p className="text-muted-foreground mt-2">Aucun top titre n'a été trouvé pour cet artiste.</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Albums section sans effet de scintillement */}
                  <TabsContent value="albums" className="mt-0">
                    {profileData.albums.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                        {profileData.albums.map((album, index) => (
                          <div 
                            key={album.id}
                            className="opacity-0 animate-fade-in"
                            style={{
                              animationDelay: `${index * 50}ms`,
                              animationFillMode: "forwards"
                            }}
                          >
                            <Card className="overflow-hidden hover:bg-white/5 transition-colors bg-black/40 border-white/10 group h-full flex flex-col">
                              <div className="aspect-square overflow-hidden relative">
                                <img 
                                  src={album.cover_medium} 
                                  alt={album.title}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="bg-spotify-accent/90 rounded-full p-3 text-white hover:bg-spotify-accent transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                    <Info className="h-5 w-5" />
                                  </div>
                                </div>
                              </div>
                              <CardContent className="p-3 flex flex-col flex-1">
                                <h3 className="font-medium truncate w-full">{album.title}</h3>
                                <div className="mt-auto pt-2">
                                  <p className="text-xs text-white/60 flex items-center gap-1.5 mt-1">
                                    <Calendar className="h-3 w-3" />
                                    {album.release_date ? new Date(album.release_date).getFullYear() : "N/A"}
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        <Disc className="h-16 w-16 mx-auto opacity-30 mb-4" />
                        <h3 className="text-xl font-medium">Aucun album disponible</h3>
                        <p className="text-muted-foreground mt-2">Aucun album n'a été trouvé pour cet artiste.</p>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground p-4">
              <User className="h-16 w-16 mb-4 opacity-50" />
              <h2 className="text-2xl font-medium">Artiste non trouvé</h2>
              <p className="mt-2 max-w-md">Les informations sur cet artiste n'ont pas pu être récupérées depuis Deezer.</p>
              <Button 
                variant="default" 
                className="mt-6"
                onClick={() => navigate('/')}
              >
                Retourner à l'accueil
              </Button>
            </div>
          )}
        </div>
      </div>
      <Player />
    </div>
  );
};

export default ArtistProfile;
