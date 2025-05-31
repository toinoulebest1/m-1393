import { Pause, Play, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Repeat1, Heart, Mic, Settings2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAudioControl } from "@/hooks/useAudioControl";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AudioEqualizer } from "@/components/AudioEqualizer";
import { toast } from "sonner";
import { extractDominantColor } from "@/utils/colorExtractor";
import { useTranslation } from "react-i18next";

export const Player = () => {
  const { t } = useTranslation();
  
  const {
    currentSong,
    isPlaying,
    progress,
    volume,
    shuffleMode,
    repeatMode,
    favorites,
    isChangingSong,
    play,
    pause,
    setVolume,
    setProgress,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
    getCurrentAudioElement
  } = usePlayer();

  const { updateVolume } = useAudioControl();
  
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentSong?.imageUrl && !currentSong.imageUrl.includes('picsum.photos')) {
      extractDominantColor(currentSong.imageUrl).then(color => setDominantColor(color));
    } else {
      setDominantColor(null);
    }
  }, [currentSong?.imageUrl]);

  useEffect(() => {
    const audioElement = getCurrentAudioElement();
    if (audioElement) {
      audioElement.muted = isMuted;
    }
  }, [isMuted, getCurrentAudioElement]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleEqualizerVisibility = () => {
    setShowEqualizer(!showEqualizer);
  };

  const handleProgressChange = (value: number[]) => {
    setProgress(value[0]);
  };

  // Fonction corrigée pour gérer le changement de volume
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    console.log("Volume change requested:", newVolume);
    
    // Update the context volume
    setVolume(newVolume);
    
    // Also update the actual audio element volume directly
    const audioElement = getCurrentAudioElement();
    if (audioElement) {
      audioElement.volume = newVolume / 100;
      console.log("Audio element volume set to:", audioElement.volume);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-spotify-dark border-t border-spotify-border z-50">
      {currentSong && showEqualizer && (
        <AudioEqualizer onClose={toggleEqualizerVisibility} />
      )}
      
      <div className="flex items-center justify-between p-4 max-w-screen-2xl mx-auto">
        {currentSong ? (
          <div className="flex items-center space-x-4 w-48 overflow-hidden">
            <div className="w-12 h-12 rounded overflow-hidden shadow-md">
              <img
                src={currentSong.imageUrl || 'https://picsum.photos/100'}
                alt="Current Song"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-white truncate">{currentSong.title}</span>
              <span className="text-xs text-spotify-neutral truncate">{currentSong.artist || 'Unknown Artist'}</span>
            </div>
          </div>
        ) : (
          <div className="w-48"></div>
        )}
        
        <div className="flex-1 flex flex-col items-center space-y-2 max-w-md mx-8">
          <div className="flex items-center space-x-4">
            <Shuffle
              className={cn("w-5 h-5 text-spotify-neutral hover:text-white transition-colors cursor-pointer", shuffleMode && "text-spotify-accent")}
              onClick={toggleShuffle}
            />
            <SkipBack
              className="w-6 h-6 text-spotify-neutral hover:text-white transition-colors cursor-pointer"
              onClick={previousSong}
              disabled={isChangingSong}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 p-0 rounded-full bg-white hover:bg-white/10"
              onClick={() => {
                if (currentSong) {
                  isPlaying ? pause() : play();
                }
              }}
              disabled={!currentSong}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 text-black" />
              ) : (
                <Play className="h-6 w-6 text-black" />
              )}
            </Button>
            <SkipForward
              className="w-6 h-6 text-spotify-neutral hover:text-white transition-colors cursor-pointer"
              onClick={nextSong}
              disabled={isChangingSong}
            />
            {repeatMode === 'none' && (
              <Repeat
                className="w-5 h-5 text-spotify-neutral hover:text-white transition-colors cursor-pointer"
                onClick={toggleRepeat}
              />
            )}
            {repeatMode === 'all' && (
              <Repeat
                className="w-5 h-5 text-spotify-accent hover:text-white transition-colors cursor-pointer"
                onClick={toggleRepeat}
              />
            )}
            {repeatMode === 'one' && (
              <Repeat1
                className="w-5 h-5 text-spotify-accent hover:text-white transition-colors cursor-pointer"
                onClick={toggleRepeat}
              />
            )}
          </div>
          
          <div className="w-full flex items-center space-x-2">
            <span className="text-xs text-spotify-neutral">
              {/* {formatTime(progress)} */}
            </span>
            <Slider
              value={[progress]}
              max={100}
              step={0.1}
              className="flex-1"
              onValueChange={handleProgressChange}
              disabled={isChangingSong || !currentSong}
            />
            <span className="text-xs text-spotify-neutral">
              {/* {formatTime(currentSong?.duration || 0)} */}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4 w-48">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleEqualizerVisibility}
          >
            <Settings2 className="h-5 w-5 text-spotify-neutral hover:text-white transition-colors cursor-pointer" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (currentSong) {
                toggleFavorite(currentSong);
              } else {
                toast.error(t('player.noSongSelected'));
              }
            }}
          >
            <Heart className={cn("w-5 h-5 transition-colors cursor-pointer", favorites.some(fav => fav.id === currentSong?.id) ? "text-red-500" : "text-spotify-neutral hover:text-white")} />
          </Button>
          
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-spotify-neutral" />
            <Slider
              value={[volume]}
              max={100}
              step={1}
              className="w-24"
              onValueChange={handleVolumeChange}
              disabled={isChangingSong}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
