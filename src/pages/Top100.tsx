import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { Trophy, Heart, Music, Trash2 } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { extractDominantColor } from "@/utils/colorExtractor";
import { cn } from "@/lib/utils";
import { SongCard } from "@/components/SongCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FavoriteStat {
  songId: string;
  count: number;
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
  const { play, currentSong, isPlaying, pause, setQueue, favorites } = usePlayer();
  const [isAdmin, setIsAdmin] = useState(false);
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>([]);
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [songToDelete, setSongToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchFavoriteStats = async () => {
    setIsLoading(true);
    try {
      const { data: hiddenSongs } = await supabase
        .from('hidden_songs')
        .select('song_id');
      
      const hiddenIds = hiddenSongs?.map(hs => hs.song_id) || [];

      const { data, error } = await supabase
        .from('favorite_stats')
        .select(`
          song_id,
          count,
          songs (
            id,
            title,
            artist,
            file_path,
            duration,
            image_url
          )
        `)
        .not('song_id', 'in', hiddenIds.length > 0 ? `(${hiddenIds.join(',')})` : '()')
        .order('count', { ascending: false })
        .limit(100);

      if (error) throw error;

      const groupedStats = data.reduce((acc: { [key: string]: FavoriteStat }, stat) => {
        if (!stat.songs) return acc;
        
        const key = `${stat.songs.title}-${stat.songs.artist}`.toLowerCase();
        
        if (!acc[key]) {
          acc[key] = {
            songId: stat.song_id,
            count: stat.count || 0,
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
          acc[key].count += (stat.count || 0);
        }
        return acc;
      }, {});

      const formattedStats = Object.values(groupedStats)
        .sort((a, b) => b.count - a.count)
        .slice(0, 100);

      setFavoriteStats(formattedStats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Impossible de charger le Top 100");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      setIsAdmin(userRole?.role === 'admin');
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    fetchFavoriteStats();

    const channel = supabase
      .channel('favorite_stats_top100_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'favorite_stats' },
        (payload) => {
          console.log('Favorite stats changed:', payload);
          fetchFavoriteStats();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hidden_songs' },
        (payload) => {
          console.log('Hidden songs changed:', payload);
          fetchFavoriteStats();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (currentSong?.imageUrl && !currentSong.imageUrl.includes('picsum.photos')) {
      extractDominantColor(currentSong.imageUrl).then(color => setDominantColor(color));
    } else {
      setDominantColor(null);
    }
  }, [currentSong?.imageUrl]);

  const handlePlay = (song: any, index: number) => {
    const songWithImage = {
      ...song,
      url: song.url,
      imageUrl: song.image_url,
      id: song.id
    };

    if (currentSong?.id === song.id) {
      isPlaying ? pause() : play();
      return;
    }

    const newQueue = favoriteStats.slice(index).map(stat => ({
      ...stat.song,
      url: stat.song.url,
      imageUrl: stat.song.image_url,
      id: stat.song.id
    }));

    setQueue(newQueue);
    localStorage.setItem('queue', JSON.stringify(newQueue));
    localStorage.setItem('lastSearchResults', JSON.stringify(favoriteStats.map(s => s.song)));
    
    play(songWithImage);
    toast.success(`Lecture: ${song.title}`);
  };

  const handleDelete = async () => {
    if (!songToDelete) return;

    try {
      const { error } = await supabase
        .from('hidden_songs')
        .insert({ song_id: songToDelete });

      if (error) throw error;

      setFavoriteStats(prev => prev.filter(stat => stat.songId !== songToDelete));
      toast.success("Chanson masquée du Top 100");
      setSongToDelete(null);
    } catch (error) {
      toast.error("Erreur lors du masquage");
    }
  };

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return "from-yellow-400 to-yellow-600 text-black";
    if (rank === 2) return "from-gray-300 to-gray-500 text-black";
    if (rank === 3) return "from-orange-400 to-orange-600 text-white";
    return "bg-white/10 text-spotify-neutral";
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Music className="w-12 h-12 text-spotify-accent animate-pulse" />
        </div>
        <Player />
      </Layout>
    );
  }

  if (favoriteStats.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-screen space-y-4">
          <Trophy className="w-20 h-20 text-spotify-neutral/50" />
          <h2 className="text-2xl font-bold text-white">Aucune chanson dans le Top 100</h2>
          <p className="text-spotify-neutral">Commencez à aimer des chansons pour les voir ici</p>
        </div>
        <Player />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-6xl mx-auto p-8 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-spotify-accent" />
                <h1 className="text-3xl font-bold text-white">
                  Top 100
                </h1>
              </div>
              <p className="text-spotify-neutral">
                {favoriteStats.length} morceaux les plus aimés
              </p>
            </div>

            {/* Liste des chansons */}
            <div className="space-y-2">
              {favoriteStats.map((stat, index) => {
                const rank = index + 1;
                const isCurrentSong = currentSong?.id === stat.song.id;
                const isFavorite = favorites.some(f => f.id === stat.song.id);

                return (
                  <div key={stat.songId} className="relative">
                    {/* Badge de rang */}
                    <div className={cn(
                      "absolute left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs",
                      rank <= 3 ? "bg-gradient-to-br" : "bg-white/10",
                      getRankBadgeStyle(rank)
                    )}>
                      #{rank}
                    </div>

                    {/* Badge de likes */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
                      <Heart className="w-3 h-3 text-spotify-accent fill-spotify-accent" />
                      <span className="text-xs font-medium text-white">{stat.count}</span>
                    </div>

                    <div className="pl-12" onClick={() => handlePlay(stat.song, index)}>
                      <SongCard
                        song={{
                          ...stat.song,
                          url: stat.song.url,
                          imageUrl: stat.song.image_url,
                          id: stat.song.id
                        }}
                        isCurrentSong={isCurrentSong}
                        isFavorite={isFavorite}
                        dominantColor={dominantColor}
                        contextMenuItems={isAdmin ? [
                          {
                            label: "Masquer du Top 100",
                            icon: <Trash2 className="w-4 h-4" />,
                            action: () => setSongToDelete(stat.songId),
                            show: true
                          }
                        ] : []}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Player />
      </div>

      {/* Dialog de confirmation suppression */}
      <AlertDialog open={!!songToDelete} onOpenChange={() => setSongToDelete(null)}>
        <AlertDialogContent className="bg-spotify-dark border-spotify-light">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Masquer cette chanson ?</AlertDialogTitle>
            <AlertDialogDescription className="text-spotify-neutral">
              Cette chanson sera retirée du Top 100 mais ne sera pas supprimée de la base de données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-spotify-light text-white hover:bg-spotify-light/80">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Masquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Top100;
