import { Pause, Play, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Repeat1, Heart } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Player = () => {
  const { 
    currentSong, 
    isPlaying, 
    progress, 
    volume,
    shuffleMode,
    repeatMode,
    favorites,
    play,
    pause,
    setVolume,
    setProgress,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite
  } = usePlayer();

  const formatTime = (progress: number) => {
    if (!currentSong) return "0:00";
    
    // If duration is missing, calculate it from the audio element
    const duration = currentSong.duration || "0:00";
    
    try {
      const [minutes, seconds] = duration.split(':').map(Number);
      if (isNaN(minutes) || isNaN(seconds)) return "0:00";
      
      const totalSeconds = minutes * 60 + seconds;
      const currentTime = (progress / 100) * totalSeconds;
      const currentMinutes = Math.floor(currentTime / 60);
      const currentSeconds = Math.floor(currentTime % 60);
      
      return `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error("Error formatting time:", error);
      return "0:00";
    }
  };

  const handleFavorite = () => {
    if (currentSong) {
      toggleFavorite(currentSong);
      toast.success(`${favorites.some(s => s.id === currentSong.id) ? 'Retiré des' : 'Ajouté aux'} favoris`);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-black/70 backdrop-blur-xl border-t border-white/5 p-4">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img
            src={currentSong?.imageUrl || "https://picsum.photos/56/56"}
            alt="Album art"
            className="w-14 h-14 rounded-lg shadow-lg transition-transform duration-300 hover:scale-105"
          />
          <div className="flex items-center space-x-2">
            <div>
              <h3 className="text-white font-medium hover:text-spotify-accent transition-colors">
                {currentSong?.title || 'Select a song'}
              </h3>
              <p className="text-spotify-neutral text-sm">{currentSong?.artist || 'No artist'}</p>
            </div>
            {currentSong && (
              <button
                onClick={handleFavorite}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <Heart
                  className={cn(
                    "w-5 h-5 transition-colors",
                    favorites.some(s => s.id === currentSong.id)
                      ? "text-red-500 fill-red-500"
                      : "text-spotify-neutral"
                  )}
                />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center space-y-2 flex-1 max-w-xl">
          <div className="flex items-center space-x-6">
            <button 
              className={cn(
                "text-spotify-neutral hover:text-white transition-all",
                shuffleMode && "text-spotify-accent"
              )}
              onClick={toggleShuffle}
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button 
              className="text-spotify-neutral hover:text-white transition-all hover:scale-110"
              onClick={previousSong}
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button 
              className="bg-white rounded-full p-2 hover:scale-110 transition-all shadow-lg hover:shadow-white/20"
              onClick={() => isPlaying ? pause() : play()}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-spotify-dark" />
              ) : (
                <Play className="w-6 h-6 text-spotify-dark" />
              )}
            </button>
            <button 
              className="text-spotify-neutral hover:text-white transition-all hover:scale-110"
              onClick={nextSong}
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <button 
              className={cn(
                "text-spotify-neutral hover:text-white transition-all",
                repeatMode !== 'none' && "text-spotify-accent"
              )}
              onClick={toggleRepeat}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="w-full flex items-center space-x-2">
            <span className="text-xs text-spotify-neutral">{formatTime(progress)}</span>
            <Slider
              value={[progress]}
              max={100}
              step={1}
              className="w-full"
              onValueChange={(value) => setProgress(value[0])}
            />
            <span className="text-xs text-spotify-neutral">{currentSong?.duration || "0:00"}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Volume2 className="text-spotify-neutral w-5 h-5" />
          <Slider
            value={[volume]}
            max={100}
            step={1}
            className="w-24"
            onValueChange={(value) => setVolume(value[0])}
          />
        </div>
      </div>
    </div>
  );
};