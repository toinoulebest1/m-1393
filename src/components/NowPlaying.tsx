
import React from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { Music, Clock, Signal, Heart } from "lucide-react";
import { toast } from "sonner";

export const NowPlaying = () => {
  const { queue, currentSong, favorites, toggleFavorite } = usePlayer();

  const handleFavorite = (song: any) => {
    toggleFavorite(song);
    const isFavorite = favorites.some(s => s.id === song.id);
    toast.success(
      <div className="flex items-center space-x-2">
        <Heart className={cn(
          "w-4 h-4 animate-scale-in",
          isFavorite ? "text-red-500 fill-red-500" : "text-spotify-neutral"
        )} />
        <span>{isFavorite ? 'Retiré des' : 'Ajouté aux'} favoris</span>
      </div>
    );
  };

  return (
    <div className="flex-1 p-8">
      <div className="flex items-center space-x-2 mb-4 p-3 border-2 border-spotify-accent rounded-lg w-fit">
        <Music className="w-6 h-6 text-spotify-accent animate-bounce" />
        <h2 className="text-2xl font-bold bg-gradient-to-r from-[#8B5CF6] via-[#D946EF] to-[#0EA5E9] bg-clip-text text-transparent animate-gradient">
          Now Playing
        </h2>
      </div>
      <div className="space-y-2">
        {queue.map((song) => (
          <div
            key={song.id}
            className={cn(
              "p-4 rounded-lg transition-all duration-300",
              currentSong?.id === song.id 
                ? "relative bg-white/5 shadow-lg overflow-hidden" 
                : "bg-transparent"
            )}
          >
            {/* Animation multicolore pour la chanson en cours */}
            {currentSong?.id === song.id && (
              <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 animate-gradient bg-gradient-to-r from-[#8B5CF6] via-[#D946EF] to-[#0EA5E9] opacity-20" 
                  style={{
                    backgroundSize: '200% 200%',
                    animation: 'gradient 3s linear infinite',
                  }}
                />
              </div>
            )}
            
            {/* Contenu de la chanson */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img
                  src={song.imageUrl || "https://picsum.photos/56/56"}
                  alt="Album art"
                  className={cn(
                    "w-14 h-14 rounded-lg shadow-lg",
                    currentSong?.id === song.id && "animate-pulse"
                  )}
                />
                <div>
                  <h3 className={cn(
                    "font-medium",
                    currentSong?.id === song.id ? "text-white" : "text-spotify-neutral"
                  )}>
                    {song.title}
                  </h3>
                  <p className="text-sm text-spotify-neutral">{song.artist}</p>
                </div>
              </div>

              {/* Informations supplémentaires */}
              <div className="flex items-center space-x-6">
                {/* Durée */}
                <div className="flex items-center space-x-1 text-spotify-neutral">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{song.duration || "0:00"}</span>
                </div>

                {/* Bitrate */}
                <div className="flex items-center space-x-1 text-spotify-neutral">
                  <Signal className="w-4 h-4" />
                  <span className="text-sm">{song.bitrate || "320 kbps"}</span>
                </div>

                {/* Bouton favoris avec animation */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavorite(song);
                  }}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                >
                  <Heart
                    className={cn(
                      "w-5 h-5 transition-all duration-300 group-hover:scale-110",
                      favorites.some(s => s.id === song.id)
                        ? "text-red-500 fill-red-500 animate-scale-in"
                        : "text-spotify-neutral"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
