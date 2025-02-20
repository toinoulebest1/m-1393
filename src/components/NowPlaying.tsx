
import React from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { Music } from "lucide-react";

export const NowPlaying = () => {
  const { queue, currentSong } = usePlayer();

  return (
    <div className="flex-1 p-8">
      <div className="flex items-center space-x-2 mb-4">
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
            <div className="relative z-10 flex items-center space-x-4">
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
          </div>
        ))}
      </div>
    </div>
  );
};
