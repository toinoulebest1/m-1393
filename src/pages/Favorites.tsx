import { Player } from "@/components/Player";
import { Sidebar } from "@/components/Sidebar";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTranslation } from "react-i18next";
import { Play, Heart, Trash2, Shuffle, Clock, Signal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ColorThief from 'colorthief';
import React from 'react';
import { Button } from "@/components/ui/button";

const Favorites = () => {
  const { t } = useTranslation();
  const { 
    favorites, 
    play, 
    currentSong, 
    isPlaying, 
    removeFavorite,
    queue,
    pause,
    setQueue 
  } = usePlayer();
  const [dominantColor, setDominantColor] = React.useState<[number, number, number] | null>(null);
  const [isChanging, setIsChanging] = React.useState(false);
  const debounceTimeout = React.useRef<number | null>(null);

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

      if (debounceTimeout.current) {
        window.clearTimeout(debounceTimeout.current);
      }

      const newQueue = [...favorites];
      setQueue(newQueue);
      
      const songIndex = favorites.findIndex(fav => fav.id === song.id);
      
      debounceTimeout.current = window.setTimeout(async () => {
        await play(newQueue[songIndex]);
        toast.success(`Lecture de ${song.title}`);
      }, 100);

    } catch (error) {
      console.error("Error playing song:", error);
      toast.error("Erreur lors de la lecture de la musique");
    }
  };

  const handlePlayAll = () => {
    if (favorites.length === 0 || isChanging) return;
    setQueue(favorites);
    play(favorites[0]);
  };

  const handleShufflePlay = () => {
    if (favorites.length === 0 || isChanging) return;
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

  React.useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        window.clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  if (favorites.length === 0) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 animate-fade-in p-8 rounded-lg bg-white/5 backdrop-blur-sm">
            <Heart className="w-16 h-16 text-spotify-accent mx-auto animate-pulse" />
            <p className="text-spotify-neutral text-lg">{t('no_favorites')}</p>
          </div>
        </div>
        <Player />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-hidden ml-64">
        <div className="max-w-6xl mx-auto space-y-8 p-6 animate-fade-in">
          <div className="flex items-center space-x-6 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-all duration-300">
              <Heart className="w-10 h-10 text-white animate-scale-in" />
            </div>
            <div className="space-y-2 flex-1">
              <h1 className="text-4xl font-bold text-white tracking-tight">{t('favorites')}</h1>
              <p className="text-spotify-neutral">{favorites.length} {favorites.length > 1 ? 'morceaux' : 'morceau'}</p>
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
            {favorites.map((song) => {
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
                          handleRemoveFavorite(song);
                        }}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors group relative"
                      >
                        <Trash2 className="w-5 h-5 text-spotify-neutral group-hover:text-red-500 transition-colors" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Player />
    </div>
  );
};

export default Favorites;
