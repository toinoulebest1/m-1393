import { usePlayer } from "@/contexts/PlayerContext";
import { useTranslation } from "react-i18next";
import { Play, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const Favorites = () => {
  const { t } = useTranslation();
  const { favorites, play, currentSong, isPlaying, addToQueue } = usePlayer();
  const { toast } = useToast();

  if (favorites.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824]">
        <div className="text-center space-y-4 animate-fade-in p-8 rounded-lg bg-white/5 backdrop-blur-sm">
          <Heart className="w-16 h-16 text-spotify-accent mx-auto animate-pulse" />
          <p className="text-spotify-neutral text-lg">{t('no_favorites')}</p>
        </div>
      </div>
    );
  }

  const handlePlay = (song: any) => {
    console.log("Playing song:", song);
    play(song);
    
    // Add remaining songs to queue
    const songIndex = favorites.findIndex(fav => fav.id === song.id);
    const remainingSongs = favorites.slice(songIndex + 1);
    console.log("Adding to queue:", remainingSongs);
    remainingSongs.forEach(song => addToQueue(song));

    toast({
      title: "Lecture démarrée",
      description: `${song.title} - ${song.artist}`,
      duration: 3000,
    });
  };

  return (
    <div className="flex-1 min-h-screen bg-gradient-to-br from-spotify-dark via-[#1e2435] to-[#141824] overflow-hidden">
      <div className="max-w-4xl mx-auto space-y-8 p-6 animate-fade-in">
        <div className="flex items-center space-x-6 mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-all duration-300">
            <Heart className="w-10 h-10 text-white animate-scale-in" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white tracking-tight">{t('favorites')}</h1>
            <p className="text-spotify-neutral">{favorites.length} morceaux</p>
          </div>
        </div>

        <div className="space-y-4">
          {favorites.map((song, index) => (
            <div
              key={song.id}
              className={cn(
                "group flex items-center space-x-4 p-4 rounded-xl transition-all duration-300",
                "hover:bg-white/10 hover:transform hover:translate-x-2",
                "animate-fade-in backdrop-blur-sm",
                {"bg-white/5": currentSong?.id === song.id}
              )}
              style={{ 
                animationDelay: `${index * 100}ms`,
                background: currentSong?.id === song.id ? 
                  "linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)" : 
                  "transparent"
              }}
              onClick={() => handlePlay(song)}
            >
              <div className="relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg">
                <img
                  src={song.imageUrl || "https://picsum.photos/64/64"}
                  alt={song.title}
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
                />
                <div className={cn(
                  "absolute inset-0 bg-black/40 flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  currentSong?.id === song.id && isPlaying && "opacity-100"
                )}>
                  <Play 
                    className={cn(
                      "w-8 h-8 text-white transform transition-transform duration-300",
                      currentSong?.id === song.id && isPlaying && "scale-110"
                    )} 
                    fill={currentSong?.id === song.id ? "white" : "none"} 
                  />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium truncate text-lg",
                  currentSong?.id === song.id ? "text-spotify-accent" : "text-white"
                )}>
                  {song.title}
                </p>
                <p className="text-sm text-spotify-neutral truncate group-hover:text-spotify-light transition-colors duration-300">
                  {song.artist}
                </p>
              </div>

              <div className="w-16 text-right text-sm text-spotify-neutral">
                {song.duration}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Favorites;