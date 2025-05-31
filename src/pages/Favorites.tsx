
import { Player } from "@/components/Player";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTranslation } from "react-i18next";
import { Heart, Shuffle, Play } from "lucide-react";
import { toast } from "sonner";
import React from 'react';
import { Button } from "@/components/ui/button";
import { SongCard } from "@/components/SongCard";
import { extractDominantColor } from "@/utils/colorExtractor";

const Favorites = () => {
  const { t } = useTranslation();
  const { 
    favorites, 
    play, 
    currentSong, 
    isPlaying, 
    removeFavorite,
    pause,
    setQueue 
  } = usePlayer();
  const [dominantColor, setDominantColor] = React.useState<[number, number, number] | null>(null);

  React.useEffect(() => {
    if (currentSong?.imageUrl && !currentSong.imageUrl.includes('picsum.photos')) {
      extractDominantColor(currentSong.imageUrl).then(color => setDominantColor(color));
    } else {
      setDominantColor(null);
    }
  }, [currentSong?.imageUrl]);

  const handlePlay = async (song: any) => {
    try {
      if (currentSong?.id === song.id) {
        if (isPlaying) {
          pause();
        } else {
          play();
        }
        return;
      }

      const newQueue = [...favorites];
      setQueue(newQueue);
      
      const songIndex = favorites.findIndex(fav => fav.id === song.id);
      await play(newQueue[songIndex]);
      toast.success(`Lecture de ${song.title}`);
    } catch (error) {
      console.error("Error playing song:", error);
      toast.error("Erreur lors de la lecture de la musique");
    }
  };

  const handlePlayAll = () => {
    if (favorites.length === 0) return;
    setQueue(favorites);
    play(favorites[0]);
  };

  const handleShufflePlay = () => {
    if (favorites.length === 0) return;
    const shuffledFavorites = [...favorites].sort(() => Math.random() - 0.5);
    setQueue(shuffledFavorites);
    play(shuffledFavorites[0]);
  };

  const handleRemoveFavorite = async (song: any) => {
    try {
      await removeFavorite(song.id);
      toast.success(`${song.title} retiré des favoris`);
    } catch (error) {
      console.error("Error removing favorite:", error);
      toast.error("Erreur lors de la suppression du favori");
    }
  };

  const songCardContextMenu = (song: any) => [
    {
      label: "Retirer des favoris",
      icon: <Heart className="h-4 w-4" />,
      action: () => handleRemoveFavorite(song),
      show: true
    }
  ];

  if (favorites.length === 0) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 animate-fade-in p-8 rounded-lg bg-white/5 backdrop-blur-sm">
            <Heart className="w-16 h-16 text-spotify-accent mx-auto animate-pulse" />
            <p className="text-spotify-neutral text-lg">{t('common.noFavorites')}</p>
          </div>
        </div>
        <Player />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto p-8 pb-32">
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-all duration-300">
                  <Heart className="w-10 h-10 text-white animate-scale-in" />
                </div>
                <div className="space-y-2 flex-1">
                  <h1 className="text-4xl font-bold text-white tracking-tight">{t('favorites')}</h1>
                  <p className="text-muted-foreground">{favorites.length} {favorites.length > 1 ? 'morceaux' : 'morceau'}</p>
                </div>
              </div>
              <div className="flex space-x-4">
                <Button
                  onClick={handlePlayAll}
                  className="bg-spotify-accent hover:bg-spotify-light text-white"
                  size="lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Tout lire
                </Button>
                <Button
                  onClick={handleShufflePlay}
                  variant="outline"
                  size="lg"
                  className="border-white/10 hover:bg-white/10"
                >
                  <Shuffle className="w-5 h-5 mr-2" />
                  Lecture aléatoire
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {favorites.map((song, index) => {
                const isFavorite = favorites.some(s => s.id === song.id);
                const isCurrentSong = currentSong?.id === song.id;
                
                return (
                  <div
                    key={song.id}
                    style={{ 
                      animation: `fadeIn 0.3s ease-out forwards ${index * 50}ms`,
                      opacity: 0,
                    }}
                    onClick={() => handlePlay(song)}
                  >
                    <SongCard
                      song={song}
                      isCurrentSong={isCurrentSong}
                      isFavorite={isFavorite}
                      dominantColor={dominantColor}
                      contextMenuItems={songCardContextMenu(song)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <Player />
    </div>
  );
};

export default Favorites;
