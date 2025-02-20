
import React from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { Music, Clock, Signal, Heart, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import ColorThief from 'colorthief';
import { Sidebar } from "@/components/Sidebar";
import { Player } from "@/components/Player";
import { getAudioFile } from '@/utils/storage';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const { history, play, favorites, toggleFavorite, setHistory } = usePlayer();

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 p-3 border-2 border-spotify-accent rounded-lg">
            <Music className="w-6 h-6 text-spotify-accent animate-bounce" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-[#8B5CF6] via-[#D946EF] to-[#0EA5E9] bg-clip-text text-transparent animate-gradient">
              {t('Historique de lecture')}
            </h2>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button 
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                <span>Supprimer l'historique</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-spotify-dark border-spotify-light">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  Supprimer l'historique ?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-spotify-neutral">
                  Êtes-vous sûr de vouloir supprimer tout votre historique d'écoute ? Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-spotify-light text-white hover:bg-spotify-light/80">
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={clearHistory}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-spotify-neutral text-center py-8">
              {t('Aucune musique écoutée récemment')}
            </p>
          ) : (
            history.map((song) => {
              const isFavorite = favorites.some(s => s.id === song.id);
              const imageSource = song.imageUrl || `https://picsum.photos/seed/${song.id}/200/200`;
              
              return (
                <div
                  key={song.id}
                  className="p-4 rounded-lg transition-all duration-300 cursor-pointer hover:bg-white/5 bg-transparent"
                  onClick={() => play(song)}
                >
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <img
                        src={imageSource}
                        alt={`Pochette de ${song.title}`}
                        className="w-14 h-14 rounded-lg shadow-lg object-cover"
                        loading="lazy"
                      />
                      <div>
                        <h3 className="font-medium text-spotify-neutral hover:text-white transition-colors">
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
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <Player />
    </div>
  );
};

export default History;
