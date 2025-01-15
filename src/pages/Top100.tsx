import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { Award, Play, Heart, Trash2, ShieldCheck, FileText } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { LyricsModal } from "@/components/LyricsModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  };
}

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=64&h=64&fit=crop&auto=format";

const Top100 = () => {
  const { play, currentSong, isPlaying, addToQueue } = usePlayer();
  const [isAdmin, setIsAdmin] = useState(false);
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>([]);
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
        
        // First, get the list of hidden song IDs
        const { data: hiddenSongsData } = await supabase
          .from('hidden_songs')
          .select('song_id');
        
        const hiddenSongIds = hiddenSongsData?.map(hs => hs.song_id) || [];
        console.log("Hidden song IDs:", hiddenSongIds);

        // Then fetch favorite stats excluding hidden songs
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
              duration
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
                duration: stat.songs.duration || "0:00"
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
        setFavoriteStats(formattedStats);
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

      await play(song);
      console.log("Lecture démarrée:", song.title);
      
      const songIndex = favoriteStats.findIndex(stat => stat.songId === song.id);
      const remainingSongs = favoriteStats
        .slice(songIndex + 1)
        .map(stat => stat.song);
      
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
      <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 animate-fade-in p-8 rounded-lg bg-white/5 backdrop-blur-sm">
            <Award className="w-16 h-16 text-spotify-accent mx-auto animate-pulse" />
            <p className="text-spotify-neutral text-lg">
              Aucune musique n'a encore été ajoutée aux favoris par la communauté
            </p>
          </div>
        </div>
        <Player />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] flex">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto space-y-8 p-6 animate-fade-in">
          {isAdmin && (
            <Alert className="border-spotify-accent bg-spotify-accent/10">
              <ShieldCheck className="h-5 w-5 text-spotify-accent" />
              <AlertDescription className="text-spotify-accent">
                Vous êtes connecté en tant qu'administrateur
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Award className="w-8 h-8 text-spotify-accent" />
              <h1 className="text-2xl font-bold">Top 100 Communautaire</h1>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-white/5 border-white/5">
                <TableHead className="text-spotify-neutral">#</TableHead>
                <TableHead className="text-spotify-neutral">Titre</TableHead>
                <TableHead className="text-spotify-neutral">Artiste</TableHead>
                <TableHead className="text-spotify-neutral">Durée</TableHead>
                <TableHead className="text-spotify-neutral">Favoris</TableHead>
                <TableHead className="text-spotify-neutral">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {favoriteStats.map((stat, index) => (
                <TableRow
                  key={stat.songId}
                  className="group hover:bg-white/10 transition-colors cursor-pointer border-white/5"
                  onClick={() => handlePlay(stat.song)}
                >
                  <TableCell className="font-medium text-white">
                    {currentSong?.id === stat.song.id && isPlaying ? (
                      <div className="w-4 h-4 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-spotify-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-spotify-accent"></span>
                      </div>
                    ) : (
                      index + 1
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <img
                        src={PLACEHOLDER_IMAGE}
                        alt={stat.song.title}
                        className="w-12 h-12 rounded-md object-cover"
                      />
                      <span className="font-medium text-white">
                        {stat.song.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-spotify-neutral">
                    {stat.song.artist}
                  </TableCell>
                  <TableCell className="text-spotify-neutral">
                    {formatDuration(stat.song.duration)}
                  </TableCell>
                  <TableCell className="text-spotify-neutral">
                    <div className="flex items-center space-x-2">
                      <Heart className="w-4 h-4 text-spotify-accent fill-spotify-accent" />
                      <span>{stat.count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlay(stat.song);
                        }}
                      >
                        <Play className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSong({
                            id: stat.song.id,
                            title: stat.song.title,
                            artist: stat.song.artist,
                          });
                        }}
                      >
                        <FileText className="w-5 h-5" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(stat.songId);
                          }}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <NowPlaying />
      <Player />
      <LyricsModal
        isOpen={!!selectedSong}
        onClose={() => setSelectedSong(null)}
        songId={selectedSong?.id || ''}
        songTitle={selectedSong?.title || ''}
        artist={selectedSong?.artist || ''}
      />
    </div>
  );
};

export default Top100;