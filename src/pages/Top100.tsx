import { Layout } from "@/components/Layout";
import { Player } from "@/components/Player";
import { Trophy, Play, Heart, Music, Trash2 } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { extractDominantColor } from "@/utils/colorExtractor";
import { cn } from "@/lib/utils";
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
  const { play, currentSong, isPlaying, pause, setQueue } = usePlayer();
  const [isAdmin, setIsAdmin] = useState(false);
  const [favoriteStats, setFavoriteStats] = useState<FavoriteStat[]>([]);
  const [dominantColors, setDominantColors] = useState<{ [key: string]: [number, number, number] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [songToDelete, setSongToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

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

    fetchFavoriteStats();

    const channel = supabase
      .channel('favorite_stats_top100')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'favorite_stats' }, fetchFavoriteStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hidden_songs' }, fetchFavoriteStats)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const extractColors = async () => {
      const newColors: { [key: string]: [number, number, number] } = {};
      
      for (const stat of favoriteStats.slice(0, 20)) {
        if (stat.song.image_url && !dominantColors[stat.songId]) {
          try {
            const color = await extractDominantColor(stat.song.image_url);
            if (color) newColors[stat.songId] = color;
          } catch (e) {}
        }
      }
      
      if (Object.keys(newColors).length > 0) {
        setDominantColors(prev => ({ ...prev, ...newColors }));
      }
    };

    if (favoriteStats.length > 0) extractColors();
  }, [favoriteStats]);

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
                const dominantColor = dominantColors[stat.songId];

                return (
                  <div
                    key={stat.songId}
                    onClick={() => handlePlay(stat.song, index)}
                    className={cn(
                      "group flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all",
                      isCurrentSong 
                        ? "bg-spotify-accent/20 hover:bg-spotify-accent/30" 
                        : "bg-white/5 hover:bg-white/10"
                    )}
                    style={
                      isCurrentSong && dominantColor
                        ? {
                            background: `linear-gradient(90deg, rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2) 0%, rgba(255,255,255,0.05) 100%)`
                          }
                        : {}
                    }
                  >
                    {/* Rang */}
                    <div className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-lg font-bold text-sm shrink-0",
                      rank <= 3 ? "bg-gradient-to-br" : "bg-white/10",
                      getRankBadgeStyle(rank)
                    )}>
                      #{rank}
                    </div>

                    {/* Pochette */}
                    <img
                      src={stat.song.image_url || "https://via.placeholder.com/48"}
                      alt={stat.song.title}
                      className="w-14 h-14 rounded-lg object-cover shadow-md"
                    />

                    {/* Info chanson */}
                    <div className="flex-1 min-w-0">
                      <h3 className={cn(
                        "font-medium truncate",
                        isCurrentSong ? "text-white font-semibold" : "text-white"
                      )}>
                        {stat.song.title}
                      </h3>
                      <p className="text-sm text-spotify-neutral truncate">
                        {stat.song.artist}
                      </p>
                    </div>

                    {/* Stats et actions */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-spotify-accent fill-spotify-accent" />
                        <span className="text-sm font-medium text-spotify-neutral">{stat.count}</span>
                      </div>

                      <span className="text-sm text-spotify-neutral min-w-[45px] text-right">
                        {stat.song.duration}
                      </span>

                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSongToDelete(stat.songId);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
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
