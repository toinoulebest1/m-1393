
import React from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Flag, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface NowPlayingProps {
  onReport?: (song: any) => void;
}

export const NowPlaying = ({ onReport }: NowPlayingProps) => {
  const { currentSong, favorites, toggleFavorite } = usePlayer();

  if (!currentSong) return null;

  const isFavorite = favorites.some(s => s.id === currentSong.id);

  return (
    <div className="p-4 border-b border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img
            src={currentSong.imageUrl || `https://picsum.photos/seed/${currentSong.id}/200/200`}
            alt={`Pochette de ${currentSong.title}`}
            className="w-16 h-16 rounded-lg shadow-xl"
          />
          <div>
            <h2 className="text-xl font-bold text-white">
              {currentSong.title}
            </h2>
            <p className="text-sm text-gray-400">
              {currentSong.artist}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => toggleFavorite(currentSong)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <Heart
              className={cn(
                "w-6 h-6",
                isFavorite
                  ? "text-red-500 fill-red-500"
                  : "text-gray-400 hover:text-white"
              )}
            />
          </button>
          {onReport && (
            <button
              onClick={() => onReport(currentSong)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <Flag className="w-6 h-6 text-gray-400 hover:text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
