
import React, { useEffect, useState } from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Music, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Player } from "@/components/Player";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReportSongDialog } from "@/components/ReportSongDialog";
import { SongCard } from "@/components/SongCard";
import { extractDominantColor } from "@/utils/colorExtractor";
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

const History = () => {
  const { t } = useTranslation();
  const location = useLocation();
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

  // Restaurer la position de scroll au retour
  React.useEffect(() => {
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

  // Update to use extracted utility
  useEffect(() => {
    if (currentSong?.imageUrl && !currentSong.imageUrl.includes('picsum.photos')) {
      extractDominantColor(currentSong.imageUrl).then(color => setDominantColor(color));
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
    
    setQueue([song]);
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
                
                return (
                  <div key={song.id} onClick={() => handlePlay(song)}>
                    <SongCard
                      song={song}
                      isCurrentSong={isCurrentSong}
                      isFavorite={isFavorite}
                      dominantColor={dominantColor}
                      onReportClick={() => setSongToReport(song)}
                    />
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
