
import React, { useState, useEffect } from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { Music, Clock, Signal, Heart } from "lucide-react";
import { toast } from "sonner";
import ColorThief from 'colorthief';

export const NowPlaying = () => {
  const { queue, currentSong, favorites, toggleFavorite, play } = usePlayer();
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [hearts, setHearts] = useState<Array<{ 
    id: number; 
    x: number; 
    delay: number;
    duration: number;
    rotation: number;
    bounceHeight: number;
  }>>([]);

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
      // Augmenter la saturation de la couleur pour un effet plus visible
      const saturatedColor: [number, number, number] = [
        Math.min(255, color[0] * 1.2), // Augmenter le rouge
        Math.min(255, color[1] * 1.2), // Augmenter le vert
        Math.min(255, color[2] * 1.2)  // Augmenter le bleu
      ];
      setDominantColor(saturatedColor);
    } catch (error) {
      console.error('Erreur lors de l\'extraction de la couleur:', error);
      setDominantColor(null);
    }
  };

  useEffect(() => {
    if (currentSong?.imageUrl && !currentSong.imageUrl.includes('picsum.photos')) {
      extractDominantColor(currentSong.imageUrl);
    } else {
      setDominantColor(null);
    }
  }, [currentSong?.imageUrl]);

  const createFloatingHearts = () => {
    const numberOfHearts = 50;
    const minDuration = 1.5;
    const maxDuration = 3;
    const screenWidth = window.innerWidth;

    const newHearts = Array.from({ length: numberOfHearts }, (_, index) => ({
      id: Date.now() + index,
      x: Math.random() * screenWidth,
      delay: Math.random() * 1.5,
      duration: minDuration + Math.random() * (maxDuration - minDuration),
      rotation: Math.random() * 720 - 360,
      bounceHeight: 30 + Math.random() * 100
    }));

    setHearts(prev => [...prev, ...newHearts]);

    newHearts.forEach((heart, index) => {
      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== heart.id));
      }, (5000 + index * 50));
    });
  };

  const handleFavorite = async (song: any) => {
    const wasFavorite = favorites.some(s => s.id === song.id);
    
    await toggleFavorite(song);
    
    if (!wasFavorite) {
      createFloatingHearts();
    }

    toast.success(
      <div className="flex items-center space-x-2">
        <Heart className={cn(
          "w-4 h-4",
          wasFavorite ? "text-spotify-neutral" : "text-red-500 fill-red-500"
        )} />
        <span>{wasFavorite ? 'Retiré des' : 'Ajouté aux'} favoris</span>
      </div>
    );
  };

  return (
    <div className="flex-1 p-8">
      {hearts.map(heart => (
        <Heart
          key={heart.id}
          className="floating-heart text-red-500 fill-red-500 w-6 h-6"
          style={{
            '--x-offset': `${Math.sin(heart.rotation) * 200}px`,
            '--fall-duration': `${heart.duration}s`,
            '--rotation': `${heart.rotation}deg`,
            '--bounce-height': `${heart.bounceHeight}px`,
            left: `${heart.x}px`,
            animationDelay: `${heart.delay}s`,
            opacity: 0,
            transform: 'translateY(-10vh)',
          } as React.CSSProperties}
        />
      ))}

      <div className="flex items-center space-x-2 mb-4 p-3 border-2 border-spotify-accent rounded-lg w-fit">
        <Music className="w-6 h-6 text-spotify-accent animate-bounce" />
        <h2 className="text-2xl font-bold bg-gradient-to-r from-[#8B5CF6] via-[#D946EF] to-[#0EA5E9] bg-clip-text text-transparent animate-gradient">
          Now Playing
        </h2>
      </div>

      <div className="space-y-2">
        {queue.map((song) => {
          const isFavorite = favorites.some(s => s.id === song.id);
          const isCurrentSong = currentSong?.id === song.id;
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
              onClick={() => play(song)}
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
                    src={song.imageUrl || "https://picsum.photos/56/56"}
                    alt="Album art"
                    className={cn(
                      "w-14 h-14 rounded-lg shadow-lg",
                      isCurrentSong && "animate-pulse"
                    )}
                    style={glowStyle}
                  />
                  <div>
                    <h3 className={cn(
                      "font-medium",
                      isCurrentSong ? "text-white" : "text-spotify-neutral"
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
                      handleFavorite(song);
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
        })}
      </div>
    </div>
  );
};
