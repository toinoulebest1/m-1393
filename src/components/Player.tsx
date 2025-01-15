import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";

export const Player = () => {
  const { 
    currentSong, 
    isPlaying, 
    progress, 
    volume,
    play,
    pause,
    setVolume,
    setProgress,
    nextSong,
    previousSong
  } = usePlayer();

  const formatTime = (progress: number) => {
    if (!currentSong) return "0:00";
    const duration = 215; // Example duration in seconds (3:35)
    const currentTime = (progress / 100) * duration;
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-spotify-dark/90 backdrop-blur-lg border-t border-white/10 p-4">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img
            src="https://picsum.photos/56/56"
            alt="Album art"
            className="w-14 h-14 rounded-md"
          />
          <div>
            <h3 className="text-white font-medium">{currentSong?.title || 'Select a song'}</h3>
            <p className="text-spotify-neutral text-sm">{currentSong?.artist || 'No artist'}</p>
          </div>
        </div>

        <div className="flex flex-col items-center space-y-2 flex-1 max-w-xl">
          <div className="flex items-center space-x-6">
            <button 
              className="text-spotify-neutral hover:text-white transition-colors"
              onClick={previousSong}
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button 
              className="bg-white rounded-full p-2 hover:scale-105 transition-transform"
              onClick={() => isPlaying ? pause() : play()}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-spotify-dark" />
              ) : (
                <Play className="w-6 h-6 text-spotify-dark" />
              )}
            </button>
            <button 
              className="text-spotify-neutral hover:text-white transition-colors"
              onClick={nextSong}
            >
              <SkipForward className="w-5 h-5" />
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