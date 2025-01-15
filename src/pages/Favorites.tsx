import { usePlayer } from "@/contexts/PlayerContext";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

const Favorites = () => {
  const { t } = useTranslation();
  const { favorites, play, currentSong, isPlaying } = usePlayer();

  if (favorites.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-spotify-neutral">{t('no_favorites')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <h1 className="text-2xl font-bold mb-6">{t('favorites')}</h1>
      <div className="space-y-2">
        {favorites.map((song) => (
          <div
            key={song.id}
            className={cn(
              "flex items-center space-x-4 p-2 rounded-lg hover:bg-white/5 cursor-pointer group",
              currentSong?.id === song.id && "bg-white/10"
            )}
            onClick={() => play(song)}
          >
            <div className="relative w-12 h-12">
              <img
                src={song.imageUrl || "https://picsum.photos/48/48"}
                alt={song.title}
                className="w-full h-full rounded-md object-cover"
              />
              <div className={cn(
                "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                currentSong?.id === song.id && isPlaying && "opacity-100"
              )}>
                <Play className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <p className="font-medium text-white">{song.title}</p>
              <p className="text-sm text-spotify-neutral">{song.artist}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Favorites;