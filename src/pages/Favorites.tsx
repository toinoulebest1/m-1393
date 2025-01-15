import { usePlayer } from "@/contexts/PlayerContext";
import { useTranslation } from "react-i18next";
import { Play, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const Favorites = () => {
  const { t } = useTranslation();
  const { favorites, play, currentSong, isPlaying, addToQueue } = usePlayer();

  if (favorites.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <Heart className="w-16 h-16 text-spotify-accent mx-auto" />
          <p className="text-spotify-neutral text-lg">{t('no_favorites')}</p>
        </div>
      </div>
    );
  }

  const handlePlay = (song: any) => {
    console.log("Playing song:", song);
    play(song);
    // Add the rest of favorites to queue
    const songIndex = favorites.findIndex(fav => fav.id === song.id);
    const remainingSongs = favorites.slice(songIndex + 1);
    remainingSongs.forEach(song => addToQueue(song));
  };

  return (
    <div className="flex-1 p-6 bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824]">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-spotify-accent to-purple-600 rounded-lg flex items-center justify-center shadow-lg animate-scale-in">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">{t('favorites')}</h1>
        </div>

        <div className="space-y-3">
          {favorites.map((song, index) => (
            <div
              key={song.id}
              className={cn(
                "flex items-center space-x-4 p-3 rounded-lg cursor-pointer group transition-all duration-300",
                "hover:bg-white/10 hover:transform hover:translate-x-2",
                "animate-fade-in",
                {"bg-white/5": currentSong?.id === song.id}
              )}
              style={{ 
                animationDelay: `${index * 100}ms`,
                background: currentSong?.id === song.id ? "linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)" : ""
              }}
              onClick={() => handlePlay(song)}
            >
              <div className="relative w-12 h-12 flex-shrink-0">
                <img
                  src={song.imageUrl || "https://picsum.photos/48/48"}
                  alt={song.title}
                  className="w-full h-full rounded-md object-cover shadow-md"
                />
                <div className={cn(
                  "absolute inset-0 bg-black/40 flex items-center justify-center rounded-md",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  currentSong?.id === song.id && isPlaying && "opacity-100"
                )}>
                  <Play className="w-6 h-6 text-white" fill={currentSong?.id === song.id ? "white" : "none"} />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium truncate",
                  currentSong?.id === song.id ? "text-spotify-accent" : "text-white"
                )}>
                  {song.title}
                </p>
                <p className="text-sm text-spotify-neutral truncate">{song.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Favorites;