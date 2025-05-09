import { Pause, Play, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Repeat1, Heart, Mic } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CastButton } from "./CastButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Progress } from "@/components/ui/progress";
import { useEffect, useRef, useState } from "react";
import { updatePositionState, durationToSeconds } from "@/utils/mediaSession";
import { Button } from "./ui/button";
import { LyricsFullscreenView } from "./LyricsFullscreenView";
import { useLocation } from "react-router-dom";

export const Player = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { 
    currentSong, 
    isPlaying, 
    progress, 
    volume,
    shuffleMode,
    repeatMode,
    favorites,
    playbackRate,
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
  
  // Check if the current page is the blind test page
  const isBlindTest = location.pathname === '/blind-test';
  
  const positionUpdateIntervalRef = useRef<number | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);

  // Set up interval to update position state for MediaSession API
  useEffect(() => {
    // Clear any existing interval
    if (positionUpdateIntervalRef.current) {
      window.clearInterval(positionUpdateIntervalRef.current);
      positionUpdateIntervalRef.current = null;
    }
    
    if ('mediaSession' in navigator && currentSong && isPlaying) {
      positionUpdateIntervalRef.current = window.setInterval(() => {
        const duration = durationToSeconds(currentSong.duration);
        const position = (progress / 100) * duration;
        
        updatePositionState(duration, position, playbackRate);
      }, 1000);
    }
    
    return () => {
      if (positionUpdateIntervalRef.current) {
        window.clearInterval(positionUpdateIntervalRef.current);
      }
    };
  }, [currentSong, isPlaying, progress, playbackRate]);

  const formatTime = (progress: number) => {
    if (!currentSong) return "0:00";
    
    try {
      if (currentSong.duration && currentSong.duration.includes(':')) {
        const [minutes, seconds] = currentSong.duration.split(':').map(Number);
        if (isNaN(minutes) || isNaN(seconds)) return "0:00";
        
        const totalSeconds = minutes * 60 + seconds;
        const currentTime = (progress / 100) * totalSeconds;
        const currentMinutes = Math.floor(currentTime / 60);
        const currentSeconds = Math.floor(currentTime % 60);
        
        return `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
      }
      
      const duration = parseFloat(currentSong.duration);
      if (isNaN(duration)) return "0:00";
      
      const currentTime = (progress / 100) * duration;
      const currentMinutes = Math.floor(currentTime / 60);
      const currentSeconds = Math.floor(currentTime % 60);
      
      return `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error("Error formatting time:", error);
      return "0:00";
    }
  };

  const formatDuration = (duration: string | undefined) => {
    if (!duration) return "0:00";
    
    try {
      if (duration.includes(':')) {
        const [minutes, seconds] = duration.split(':').map(Number);
        if (isNaN(minutes) || isNaN(seconds)) return "0:00";
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      const durationInSeconds = parseFloat(duration);
      if (isNaN(durationInSeconds)) return "0:00";
      
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = Math.floor(durationInSeconds % 60);
      
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error("Error formatting duration:", error);
      return "0:00";
    }
  };

  const handleFavorite = () => {
    if (currentSong) {
      toggleFavorite(currentSong);
      toast.success(`${favorites.some(s => s.id === currentSong.id) ? 'Retiré des' : 'Ajouté aux'} favoris`);
    }
  };

  const toggleLyrics = () => {
    setShowLyrics(!showLyrics);
  };
  
  // Function to get displayed song info for blind test mode
  const getDisplayedSongInfo = () => {
    if (!isBlindTest || !currentSong) {
      return { title: currentSong?.title, artist: currentSong?.artist };
    }
    
    // In blind test, hide information
    const urlParams = new URLSearchParams(location.search);
    const mode = urlParams.get('mode');
    const gameState = urlParams.get('state');
    
    // If the game is over or answer was shown, display full info
    if (gameState === 'over' || gameState === 'answered') {
      return { title: currentSong.title, artist: currentSong.artist };
    }
    
    // Otherwise mask based on game mode
    if (mode === 'title') {
      return { title: '••••••', artist: currentSong.artist };
    } else if (mode === 'artist') {
      return { title: currentSong.title, artist: '••••••' };
    } else {
      return { title: '••••••', artist: '••••••' };
    }
  };
  
  // Function to determine if image should be blurred in blind test
  const shouldBlurImage = () => {
    if (!isBlindTest) return false;
    
    const urlParams = new URLSearchParams(location.search);
    const gameState = urlParams.get('state');
    
    // Only show clear image if game is over or answer was shown
    return !(gameState === 'over' || gameState === 'answered');
  };
  
  // Helper function to prevent right-click on images during blind test
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isBlindTest) {
      e.preventDefault();
      return false;
    }
  };
  
  // Helper to get placeholder image for blind test
  const getImageSrc = () => {
    if (isBlindTest && shouldBlurImage()) {
      // Use a generic music placeholder instead of the actual image
      return "https://picsum.photos/56/56";
    }
    return currentSong?.imageUrl || "https://picsum.photos/56/56";
  };
  
  const handleSkipForward = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Next song button clicked");
    
    // Add a toast to provide feedback
    toast.info("Passer à la chanson suivante");
    
    // Call the nextSong function from PlayerContext
    nextSong();
  };
  
  const handleSkipBack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Previous song button clicked");
    
    // Add a toast to provide feedback
    toast.info("Revenir à la chanson précédente");
    
    // Call the previousSong function from PlayerContext
    previousSong();
  };
  
  const handlePlayPause = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Play/pause button clicked");
    
    if (isPlaying) {
      pause();
      toast.info("Lecture en pause");
    } else {
      play();
      toast.info("Lecture en cours");
    }
  };
  
  const songInfo = getDisplayedSongInfo();
  const blurImage = shouldBlurImage();

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-95 border-t border-white/5 p-4 z-50">
        <div className="max-w-7xl mx-auto">
          {!isMobile ? (
            // Affichage standard pour ordinateurs
            <div className="flex items-center justify-between">
              <div className="flex items-center flex-1 min-w-0">
                {currentSong && (
                  <>
                    <div className="relative w-14 h-14 mr-4">
                      <img
                        src={getImageSrc()}
                        alt="Album art"
                        className={cn(
                          "w-full h-full rounded-lg shadow-lg",
                          blurImage && "blur-md"
                        )}
                        onContextMenu={handleContextMenu}
                        draggable="false"
                      />
                      {blurImage && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center z-10"
                          onContextMenu={handleContextMenu}
                        >
                          <Mic className="w-6 h-6 text-white/50" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-white truncate">
                        {songInfo.title || '••••••'}
                      </h3>
                      <p className="text-sm text-spotify-neutral truncate">
                        {songInfo.artist || '••••••'}
                      </p>
                    </div>
                    <button
                      onClick={handleFavorite}
                      className="ml-4 p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                      <Heart
                        className={cn(
                          "w-5 h-5 transition-all duration-300",
                          favorites.some(s => s.id === currentSong.id)
                            ? "text-red-500 fill-red-500"
                            : "text-spotify-neutral hover:text-white"
                        )}
                      />
                    </button>
                  </>
                )}
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
                    onClick={handleSkipBack}
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button 
                    className="bg-white rounded-full p-2 hover:scale-110 transition-all shadow-lg hover:shadow-white/20"
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-spotify-dark" />
                    ) : (
                      <Play className="w-6 h-6 text-spotify-dark" />
                    )}
                  </button>
                  <button 
                    className="text-spotify-neutral hover:text-white transition-all hover:scale-110"
                    onClick={handleSkipForward}
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
                  <span className="text-xs text-spotify-neutral">{formatDuration(currentSong?.duration)}</span>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {currentSong && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "text-spotify-neutral hover:text-white transition-all",
                      showLyrics && "text-spotify-accent"
                    )}
                    onClick={toggleLyrics}
                    title="Afficher les paroles"
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                )}
                <CastButton />
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
          ) : (
            // Mise en page adaptée pour mobiles
            <div className="flex flex-col space-y-2">
              {currentSong && (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="relative w-12 h-12">
                      <img
                        src={getImageSrc()}
                        alt="Album art"
                        className={cn(
                          "w-full h-full rounded-md shadow-md",
                          blurImage && "blur-md"
                        )}
                        onContextMenu={handleContextMenu}
                        draggable="false"
                      />
                      {blurImage && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center z-10"
                          onContextMenu={handleContextMenu}
                        >
                          <Mic className="w-5 h-5 text-white/50" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 max-w-[50vw]">
                      <h3 className="font-medium text-white text-sm truncate">
                        {songInfo.title || '••••••'}
                      </h3>
                      <p className="text-xs text-spotify-neutral truncate">
                        {songInfo.artist || '••••••'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleFavorite}
                      className="p-1.5 hover:bg-white/5 rounded-full transition-colors"
                    >
                      <Heart
                        className={cn(
                          "w-4 h-4 transition-all duration-300",
                          favorites.some(s => s.id === currentSong.id)
                            ? "text-red-500 fill-red-500"
                            : "text-spotify-neutral hover:text-white"
                        )}
                      />
                    </button>
                    {currentSong && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "p-1.5 text-spotify-neutral hover:text-white transition-all",
                          showLyrics && "text-spotify-accent"
                        )}
                        onClick={toggleLyrics}
                      >
                        <Mic className="w-4 h-4" />
                      </Button>
                    )}
                    <CastButton />
                  </div>
                </div>
              )}

              {/* Durée affichée pour les mobiles */}
              <div className="flex items-center justify-between text-xs px-1 mb-0.5">
                <span className="text-spotify-neutral">{formatTime(progress)}</span>
                <span className="text-spotify-neutral">{formatDuration(currentSong?.duration)}</span>
              </div>

              {/* Barre de progression pour mobiles */}
              <Progress 
                value={progress} 
                className="h-1.5 w-full bg-secondary/30" 
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = ((e.clientX - rect.left) / rect.width) * 100;
                  setProgress(Math.max(0, Math.min(100, percent)));
                }}
              />

              {/* Contrôles de lecture pour mobiles */}
              <div className="flex items-center justify-between mt-1 pt-1">
                <button 
                  className={cn(
                    "text-spotify-neutral p-1.5 hover:text-white transition-all",
                    shuffleMode && "text-spotify-accent"
                  )}
                  onClick={toggleShuffle}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>

                <button 
                  className="text-spotify-neutral hover:text-white p-1.5 transition-all"
                  onClick={handleSkipBack}
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                
                <button 
                  className="bg-white rounded-full p-2 hover:scale-105 transition-all"
                  onClick={handlePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-spotify-dark" />
                  ) : (
                    <Play className="w-5 h-5 text-spotify-dark" />
                  )}
                </button>
                
                <button 
                  className="text-spotify-neutral hover:text-white p-1.5 transition-all"
                  onClick={handleSkipForward}
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                
                <button 
                  className={cn(
                    "text-spotify-neutral p-1.5 hover:text-white transition-all",
                    repeatMode !== 'none' && "text-spotify-accent"
                  )}
                  onClick={toggleRepeat}
                >
                  {repeatMode === 'one' ? (
                    <Repeat1 className="w-3.5 h-3.5" />
                  ) : (
                    <Repeat className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Add protection styles with dangerouslySetInnerHTML instead of jsx global */}
      {isBlindTest && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              img {
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
              }
            `
          }}
        />
      )}
      
      {/* Affichage des paroles en plein écran */}
      {showLyrics && currentSong && (
        <LyricsFullscreenView 
          song={currentSong} 
          onClose={() => setShowLyrics(false)} 
        />
      )}
    </>
  );
};
