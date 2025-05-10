import React from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { Music, Clock, Signal, Heart, Trash2, Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import ColorThief from 'colorthief';
import { Player } from "@/components/Player";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReportSongDialog } from "@/components/ReportSongDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";

const History = () => {
  const { t } = useTranslation();
  const { 
    history, 
    play, 
    pause, 
    isPlaying, 
    favorites, 
    toggleFavorite, 
    setHistory, 
    currentSong,
    setQueue 
  } = usePlayer();
  const [dominantColor, setDominantColor] = React.useState<[number, number, number] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [songToReport, setSongToReport] = React.useState<any>(null);

  const loadHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data: historyData, error: historyError } = await supabase
        .from('play_history')
        .select(`
          song_id,
          played_at,
          songs (
            id,
            title,
            artist,
            file_path,
            duration,
            image_url
          )
        `)
        .eq('user_id', session.user.id)
        .order('played_at', { ascending: false });

      if (historyError) {
        console.error("Erreur lors du chargement de l'historique:", historyError);
        toast.error("Erreur lors du chargement de l'historique");
        return;
      }

      if (historyData) {
        const uniqueSongs = new Map();
        historyData.forEach(item => {
          if (!uniqueSongs.has(item.songs.id)) {
            uniqueSongs.set(item.songs.id, {
              id: item.songs.id,
              title: item.songs.title,
              artist: item.songs.artist || '',
              duration: item.songs.duration || '0:00',
              url: item.songs.file_path,
              imageUrl: item.songs.image_url,
              bitrate: '320 kbps',
              playedAt: item.played_at
            });
          }
        });

        const formattedHistory = Array.from(uniqueSongs.values());
        setHistory(formattedHistory);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique:", error);
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();

    const channel = supabase
      .channel('play_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'play_history'
        },
        async (payload) => {
          console.log('Changement détecté dans play_history:', payload);
          await loadHistory();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

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

  React.useEffect(() => {
    if (currentSong?.imageUrl && !currentSong.imageUrl.includes('picsum.photos')) {
      extractDominantColor(currentSong.imageUrl);
    } else {
      setDominantColor(null);
    }
  }, [currentSong?.imageUrl]);

  const clearHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('play_history')
        .delete()
        .eq('user_id', session.user.id);

      if (error) {
        console.error("Erreur lors de la suppression de l'historique:", error);
        toast.error("Erreur lors de la suppression de l'historique");
        return;
      }

      setHistory([]);
      toast.success("Historique supprimé avec succès");
    } catch (error) {
      console.error("Erreur lors de la suppression de l'historique:", error);
      toast.error("Erreur lors de la suppression de l'historique");
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

    console.log(`Playing song from history: ${song.title}`);
    
    // Create a new queue with just this song and make it the current queue
    setQueue([song]);
    
    // Start playing the song
    play(song);
    
    toast.success(`Lecture de : ${song.title}`);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto p-8 pb-32">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 p-3 border-2 border-spotify-accent rounded-lg">
              <Music className="w-6 h-6 text-spotify-accent animate-bounce" />
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[#8B5CF6] via-[#D946EF] to-[#0EA5E9] bg-clip-text text-transparent animate-gradient">
                {t('common.history')}
              </h2>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button 
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>{t('common.deleteHistory')}</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-spotify-dark border-spotify-light">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">
                    {t('common.confirmDeleteHistory')}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-spotify-neutral">
                    {t('common.confirmDeleteHistoryMessage')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-spotify-light text-white hover:bg-spotify-light/80">
                    {t('common.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearHistory}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-spotify-neutral text-center py-8">
                {t('common.loading')}
              </p>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
                <Music className="w-16 h-16 text-spotify-neutral opacity-50" />
                <p className="text-spotify-neutral text-lg">
                  {t('common.emptyHistory')}
                </p>
                <p className="text-spotify-neutral text-sm">
                  {t('common.startListening')}
                </p>
              </div>
            ) : (
              history.map((song) => {
                const isFavorite = favorites.some(s => s.id === song.id);
                const isCurrentSong = currentSong?.id === song.id;
                const imageSource = song.imageUrl || `https://picsum.photos/seed/${song.id}/200/200`;
                
                const glowStyle = isCurrentSong && dominantColor ? {
                  boxShadow: `
                    0 0 10px 5px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.3),
                    0 0 20px 10px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2),
                    0 0 30px 15px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.1)
                  `,
                  transition: 'box-shadow 0.3s ease-in-out',
                  transform: 'scale(1.02)',
                } : {};

                return (
                  <div
                    key={song.id}
                    className={cn(
                      "p-4 rounded-lg transition-all duration-300 cursor-pointer hover:bg-white/5",
                      isCurrentSong 
                        ? "relative bg-white/5 shadow-lg overflow-hidden" 
                        : "bg-transparent"
                    )}
                    onClick={() => handlePlay(song)}
                  >
                    {isCurrentSong && (
                      <div className="absolute inset-0 z-0 overflow-hidden">
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

                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img
                          src={imageSource}
                          alt={`Pochette de ${song.title}`}
                          className={cn(
                            "w-14 h-14 rounded-lg shadow-lg object-cover",
                            isCurrentSong && "animate-pulse"
                          )}
                          style={glowStyle}
                          loading="lazy"
                        />
                        <div>
                          <h3 className={cn(
                            "font-medium transition-colors",
                            isCurrentSong ? "text-white" : "text-spotify-neutral hover:text-white"
                          )}>
                            {song.title}
                          </h3>
                          <p className="text-sm text-spotify-neutral">{song.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-1 text-spotify-neutral">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">{song.duration || "0:00"}</span>
                        </div>

                        <div className="flex items-center space-x-1 text-spotify-neutral">
                          <Signal className="w-4 h-4" />
                          <span className="text-sm">{song.bitrate || "320 kbps"}</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(song);
                          }}
                          className="p-2 hover:bg-white/5 rounded-full transition-colors group relative"
                        >
                          <Heart
                            className={cn(
                              "w-5 h-5 transition-all duration-300 group-hover:scale-110",
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
                          className="p-2 hover:bg-white/5 rounded-full transition-colors group relative"
                        >
                          <Flag className="w-5 h-5 text-spotify-neutral group-hover:text-white transition-all duration-300 group-hover:scale-110" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
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

export default History;
