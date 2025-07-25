import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { Award, Play, Heart, Trash2, ShieldCheck, FileText } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { LyricsModal } from "@/components/LyricsModal";
import { cn } from "@/lib/utils";
import { extractDominantColor } from "@/utils/colorExtractor";

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=64&h=64&fit=crop&auto=format";

interface FavoriteStat {
  songId: string;
  count: number;
  lastUpdated: string;
  song: {
    id: string;
    title: string;
    artist: string;
    url: string;
    duration: string;
    image_url?: string;
  };
}

const Top100 = () => {
  const { play, currentSong, isPlaying, addToQueue } = usePlayer();
  const [isAdmin, setIsAdmin] = useState(false);
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>([]);
  const [dominantColors, setDominantColors] = useState<{ [key: string]: [number, number, number] }>({});
  const [previousPositions, setPreviousPositions] = useState<{ [key: string]: number }>({});
  const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedSong, setSelectedSong] = useState<{ id: string; title: string; artist?: string } | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          navigate('/auth');
          return;
        }

        if (!session) {
          console.log("No active session found");
          navigate('/auth');
          return;
        }

        const checkAdminStatus = async () => {
          try {
            console.log("Checking admin status for user:", session.user.id);
            const { data: userRole, error: roleError } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .single();

            if (roleError) {
              console.error("Error fetching user role:", roleError);
              return;
            }

            console.log("User role data:", userRole);
            setIsAdmin(userRole?.role === 'admin');
          } catch (error) {
            console.error("Admin check error:", error);
          }
        };

        await checkAdminStatus();
      } catch (error) {
        console.error("Session check error:", error);
        navigate('/auth');
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    const fetchFavoriteStats = async () => {
      try {
        console.log("Fetching favorite stats...");
        
        const { data: hiddenSongsData } = await supabase
          .from('hidden_songs')
          .select('song_id');
        
        const hiddenSongIds = hiddenSongsData?.map(hs => hs.song_id) || [];
        console.log("Hidden song IDs:", hiddenSongIds);

        const { data, error } = await supabase
          .from('favorite_stats')
          .select(`
            song_id,
            count,
            last_updated,
            songs (
              id,
              title,
              artist,
              file_path,
              created_at,
              duration,
              image_url
            )
          `)
          .not('song_id', 'in', `(${hiddenSongIds.join(',')})`)
          .order('count', { ascending: false });

        if (error) {
          console.error("Error fetching favorite stats:", error);
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible de charger le top 100",
          });
          return;
        }

        console.log("Received favorite stats:", data);

        const groupedStats = data.reduce((acc: { [key: string]: FavoriteStat }, stat) => {
          if (!stat.songs) return acc;
          
          const key = `${stat.songs.title.toLowerCase()}-${(stat.songs.artist || '').toLowerCase()}`;
          
          if (!acc[key]) {
            acc[key] = {
              songId: stat.song_id,
              count: stat.count || 0,
              lastUpdated: stat.last_updated,
              song: {
                id: stat.songs.id,
                title: stat.songs.title,
                artist: stat.songs.artist || '',
                url: stat.songs.file_path,
                duration: stat.songs.duration || "0:00",
                image_url: stat.songs.image_url
              }
            };
          } else {
            if (stat.count) {
              acc[key].count = (acc[key].count || 0) + stat.count;
            }
            if (new Date(stat.last_updated) > new Date(acc[key].lastUpdated)) {
              acc[key].lastUpdated = stat.last_updated;
            }
          }
          return acc;
        }, {});

        const formattedStats = Object.values(groupedStats)
          .sort((a, b) => (b.count || 0) - (a.count || 0))
          .slice(0, 100);

        console.log("Formatted and grouped stats:", formattedStats);
        
        // Détecter les changements de position pour les animations
        const newPositions: { [key: string]: number } = {};
        const newAnimatingItems = new Set<string>();
        
        formattedStats.forEach((stat, index) => {
          const songKey = stat.songId;
          newPositions[songKey] = index;
          
          // Si la chanson existait avant et a changé de position
          if (previousPositions[songKey] !== undefined && previousPositions[songKey] !== index) {
            newAnimatingItems.add(songKey);
          }
        });
        
        // Mettre à jour les positions et déclencher les animations
        setPreviousPositions(newPositions);
        setAnimatingItems(newAnimatingItems);
        setFavoriteStats(formattedStats);
        
        // Nettoyer les animations après un délai
        if (newAnimatingItems.size > 0) {
          setTimeout(() => {
            setAnimatingItems(new Set());
          }, 800);
        }
      } catch (error) {
        console.error("Error in fetchFavoriteStats:", error);
      }
    };

    fetchFavoriteStats();

    const favoriteStatsChannel = supabase
      .channel('favorite_stats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorite_stats'
        },
        (payload) => {
          console.log("Favorite stats changed:", payload);
          fetchFavoriteStats();
        }
      )
      .subscribe();

    const hiddenSongsChannel = supabase
      .channel('hidden_songs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hidden_songs'
        },
        (payload) => {
          console.log("Hidden songs changed:", payload);
          fetchFavoriteStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(favoriteStatsChannel);
      supabase.removeChannel(hiddenSongsChannel);
    };
  }, [toast]);

  // Extract dominant colors for images
  useEffect(() => {
    const extractColors = async () => {
      const newColors: { [key: string]: [number, number, number] } = {};
      
      for (const stat of favoriteStats) {
        if (stat.song.image_url && !dominantColors[stat.songId]) {
          try {
            const color = await extractDominantColor(stat.song.image_url);
            if (color) {
              newColors[stat.songId] = color;
            }
          } catch (error) {
            console.error("Error extracting color for", stat.song.title, error);
          }
        }
      }
      
      if (Object.keys(newColors).length > 0) {
        setDominantColors(prev => ({ ...prev, ...newColors }));
      }
    };

    if (favoriteStats.length > 0) {
      extractColors();
    }
  }, [favoriteStats, dominantColors]);

  const handlePlay = async (song: any) => {
    try {
      console.log("Tentative de lecture de la chanson:", song);
      if (!song) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Chanson invalide"
        });
        return;
      }

      const songWithImage = {
        ...song,
        url: song.url,
        imageUrl: song.image_url,
        duration: song.duration,
        title: song.title,
        artist: song.artist,
        id: song.id
      };

      await play(songWithImage);
      console.log("Lecture démarrée:", songWithImage.title);
      
      const songIndex = favoriteStats.findIndex(stat => stat.songId === song.id);
      const remainingSongs = favoriteStats
        .slice(songIndex + 1)
        .map(stat => ({
          ...stat.song,
          url: stat.song.url,
          imageUrl: stat.song.image_url,
          duration: stat.song.duration,
          title: stat.song.title,
          artist: stat.song.artist,
          id: stat.song.id
        }));
      
      console.log("Ajout à la file d'attente:", remainingSongs);
      
      remainingSongs.forEach(nextSong => {
        if (nextSong) {
          console.log("Ajout à la file d'attente:", nextSong.title);
          addToQueue(nextSong);
        }
      });
    } catch (error) {
      console.error("Erreur lors de la lecture:", error);
      toast({
        variant: "destructive",
        title: "Erreur de lecture",
        description: "Impossible de lire cette chanson"
      });
    }
  };

  const handleDelete = async (songId: string) => {
    try {
      console.log("Checking if song is already hidden:", songId);
      
      const { data: existingHidden } = await supabase
        .from('hidden_songs')
        .select('id')
        .eq('song_id', songId)
        .single();

      if (existingHidden) {
        console.log("Song is already hidden:", songId);
        toast({
          title: "Information",
          description: "Cette musique est déjà masquée",
        });
        return;
      }

      console.log("Masquage de la chanson dans la base de données:", songId);
      const { error } = await supabase
        .from('hidden_songs')
        .insert({ song_id: songId });

      if (error) {
        console.error("Erreur lors du masquage de la chanson:", error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de masquer la chanson"
        });
        return;
      }

      setFavoriteStats(prev => prev.filter(stat => stat.songId !== songId));
      toast({
        title: "Succès",
        description: "La musique a été masquée",
      });
    } catch (error) {
      console.error("Erreur lors du masquage de la chanson:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors du masquage de la chanson"
      });
    }
  };

  const formatDuration = (duration: string) => {
    if (!duration) return "0:00";
    
    try {
      if (duration.includes(':')) {
        const [minutes, seconds] = duration.split(':').map(Number);
        if (isNaN(minutes) || isNaN(seconds)) return "0:00";
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      const durationInSeconds = parseFloat(duration);
      if (isNaN(durationInSeconds)) return "0:00";
      
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = Math.floor(durationInSeconds % 60);
      
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error("Error formatting duration:", error);
      return "0:00";
    }
  };

  if (favoriteStats.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto p-6 max-w-6xl">
          <div className="text-center space-y-4 py-20">
            <Award className="w-16 h-16 text-spotify-accent mx-auto" />
            <h1 className="text-3xl font-bold text-white">Top 100</h1>
            <p className="text-spotify-neutral text-lg">
              Aucune musique n'a encore été ajoutée aux favoris par la communauté
            </p>
          </div>
        </div>
        <Player />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-6xl">
        {isAdmin && (
          <Alert className="mb-6 border-spotify-accent bg-spotify-accent/10">
            <ShieldCheck className="h-5 w-5 text-spotify-accent" />
            <AlertDescription className="text-spotify-accent">
              Vous êtes connecté en tant qu'administrateur
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Top 100</h1>
              <p className="text-spotify-neutral">{favoriteStats.length} morceaux les plus aimés</p>
            </div>
          </div>

          <div className="bg-white/5 rounded-lg overflow-hidden">
            <div className="space-y-0">
              {favoriteStats.map((stat, index) => {
                const isCurrentSong = currentSong?.id === stat.song.id;
                const rankNumber = index + 1;
                const isTop3 = rankNumber <= 3;
                const dominantColor = dominantColors[stat.songId];

                const isAnimating = animatingItems.has(stat.songId);
                const previousPos = previousPositions[stat.songId];
                const hasMovedUp = previousPos !== undefined && previousPos > index;
                const hasMovedDown = previousPos !== undefined && previousPos < index;

                return (
                  <div
                    key={stat.songId}
                    className={cn(
                      "group p-4 transition-all duration-500 cursor-pointer border-b border-white/5 last:border-b-0 relative overflow-hidden",
                      isCurrentSong 
                        ? "bg-spotify-accent/20" 
                        : "hover:bg-white/5",
                      isAnimating && "animate-scale-in",
                      hasMovedUp && isAnimating && "animate-slide-in-right",
                      hasMovedDown && isAnimating && "animate-fade-in"
                    )}
                    onClick={() => handlePlay(stat.song)}
                    style={
                      isCurrentSong && dominantColor
                        ? {
                            background: `linear-gradient(135deg, rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.15) 0%, rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.05) 100%)`,
                            borderColor: `rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.3)`,
                          }
                        : {}
                    }
                  >
                    {isCurrentSong && dominantColor && (
                      <div 
                        className="absolute inset-0 opacity-10"
                        style={{
                          background: `radial-gradient(circle at 20% 80%, rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.4) 0%, transparent 50%)`
                        }}
                      />
                    )}
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center space-x-4">
                        <div className={cn(
                          "w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-all duration-500",
                          isTop3 ? "bg-gradient-to-br" : "bg-white/10",
                          rankNumber === 1 && "from-yellow-400 to-yellow-600 text-black",
                          rankNumber === 2 && "from-gray-300 to-gray-400 text-black",
                          rankNumber === 3 && "from-amber-600 to-amber-800 text-white",
                          !isTop3 && "text-spotify-neutral",
                          isAnimating && "animate-pulse"
                        )}>
                          #{rankNumber}
                        </div>
                        
                        <div className={cn(
                          "relative transition-transform duration-500",
                          isAnimating && "hover-scale"
                        )}>
                          <img
                            src={stat.song.image_url || PLACEHOLDER_IMAGE}
                            alt={`Pochette de ${stat.song.title}`}
                            className={cn(
                              "w-12 h-12 rounded-lg object-cover shadow-lg transition-all duration-500",
                              isCurrentSong && "ring-2 ring-white/30",
                              isAnimating && "animate-scale-in"
                            )}
                            loading="lazy"
                            style={
                              isCurrentSong && dominantColor
                                ? {
                                    boxShadow: `0 4px 20px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.4)`
                                  }
                                : {}
                            }
                          />
                          {isCurrentSong && (
                            <div className="absolute inset-0 rounded-lg border-2 border-white/20 animate-pulse" />
                          )}
                          {isAnimating && (
                            <div className="absolute inset-0 rounded-lg border-2 border-spotify-accent/50 animate-pulse" />
                          )}
                        </div>
                        
                        <div className={cn(
                          "min-w-0 flex-1 transition-all duration-500",
                          isAnimating && "animate-fade-in"
                        )}>
                          <h3 className={cn(
                            "font-medium truncate transition-all duration-300",
                            isCurrentSong ? "text-white font-semibold" : "text-white",
                            isAnimating && "text-spotify-accent"
                          )}>
                            {stat.song.title}
                          </h3>
                          <p className={cn(
                            "text-sm text-spotify-neutral truncate transition-all duration-300",
                            isAnimating && "text-white/80"
                          )}>
                            {stat.song.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2 text-spotify-neutral">
                          <Heart className="w-4 h-4 text-spotify-accent fill-spotify-accent" />
                          <span className="text-sm font-medium">{stat.count || 0}</span>
                        </div>

                        <span className="text-sm text-spotify-neutral min-w-[40px] text-right">
                          {formatDuration(stat.song.duration)}
                        </span>

                        {isAdmin && (
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-white/10 text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlay(stat.song);
                              }}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-white/10 text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSong({
                                  id: stat.song.id,
                                  title: stat.song.title,
                                  artist: stat.song.artist,
                                });
                              }}
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(stat.songId);
                              }}
                              title="Masquer du Top 100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <LyricsModal
          isOpen={!!selectedSong}
          onClose={() => setSelectedSong(null)}
          songId={selectedSong?.id || ''}
          songTitle={selectedSong?.title || ''}
          artist={selectedSong?.artist || ''}
        />
      </div>
      <Player />
    </Layout>
  );
};

export default Top100;
