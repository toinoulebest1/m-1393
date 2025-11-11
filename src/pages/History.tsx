import React, { useEffect, useState } from 'react';
import { Layout } from "@/components/Layout";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLocation } from "react-router-dom";
import { Music, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
            image_url,
            genre,
            album_name,
            tidal_id
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
          // Assurer que l'objet `songs` et son `id` existent
          if (item.songs && item.songs.id) {
            // Utiliser un identifiant unique pour la map pour éviter les doublons
            const mapKey = item.songs.id;
            
            // Si la chanson n'est pas déjà dans la map, on l'ajoute
            if (!uniqueSongs.has(mapKey)) {
              uniqueSongs.set(mapKey, {
                // On reconstruit l'objet Song complet
                id: item.songs.id,
                title: item.songs.title,
                artist: item.songs.artist || '',
                duration: item.songs.duration || '0:00',
                // L'URL est soit le chemin du fichier, soit un identifiant Tidal
                url: item.songs.tidal_id ? `tidal:${item.songs.tidal_id}` : item.songs.file_path,
                imageUrl: item.songs.image_url,
                album_name: item.songs.album_name,
                tidal_id: item.songs.tidal_id, // On s'assure que tidal_id est bien là
                isLocal: !item.songs.tidal_id, // Une chanson est locale si elle n'a pas d'ID Tidal
                playedAt: item.played_at
              });
            }
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
          // console.log('Changement détecté dans play_history:', payload);
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
    
    // Créer la queue complète à partir de la chanson cliquée
    const songIndex = history.findIndex(s => s.id === song.id);
    const newQueue = songIndex >= 0 ? history.slice(songIndex) : [song];
    
    // Sauvegarder la queue et les résultats pour la navigation
    setQueue(newQueue);
    localStorage.setItem('queue', JSON.stringify(newQueue));
    localStorage.setItem('lastSearchResults', JSON.stringify(history));
    
    play(song);
    toast.success(`Lecture de : ${song.title}`);
  };

  return (
    <Layout>
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-6xl mx-auto p-8 pb-32">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Music className="w-8 h-8 text-spotify-accent" />
                <h1 className="text-3xl font-bold text-white">
                  {t('common.history')}
                </h1>
              </div>

              {history.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button 
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">{t('common.deleteHistory')}</span>
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
              )}
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-spotify-neutral">{t('common.loading')}</p>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
                  <Music className="w-20 h-20 text-spotify-neutral/50" />
                  <div>
                    <p className="text-spotify-neutral text-lg mb-2">
                      {t('common.emptyHistory')}
                    </p>
                    <p className="text-spotify-neutral/70 text-sm">
                      {t('common.startListening')}
                    </p>
                  </div>
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
        
        <ReportSongDialog
          song={songToReport}
          onClose={() => setSongToReport(null)}
          open={!!songToReport}
        />
      </div>
    </Layout>
  );
};

export default History;