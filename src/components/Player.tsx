import { Pause, Play, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Repeat1, Heart, Mic, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { extractDominantColor } from "@/utils/colorExtractor";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { CastButton } from "@/components/CastButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Progress } from "@/components/ui/progress";

export const Player = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  const {
    currentSong,
    displayedSong,
    isPlaying,
    progress,
    volume,
    shuffleMode,
    repeatMode,
    favorites,
    isChangingSong,
    isAudioReady,
    play,
    pause,
    setVolume,
    setProgress,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
    getCurrentAudioElement,
    setIsSeeking
  } = usePlayer();

  const [metadataOpacity, setMetadataOpacity] = useState(1);
  const [previousSongData, setPreviousSongData] = useState<{ title: string; artist: string; imageUrl: string } | null>(null);
  const [localProgress, setLocalProgress] = useState<number | null>(null);

  // We need to get the required parameters for useAudioControl from the PlayerContext
  // For now, let's create a simplified version that just handles volume updates
  const updateVolumeDirectly = (newVolume: number) => {
    const audioElement = getCurrentAudioElement();
    if (audioElement) {
      console.log("=== VOLUME DEBUG ===");
      console.log("Setting volume to:", newVolume / 100);
      console.log("Audio element muted:", audioElement.muted);
      console.log("Audio element readyState:", audioElement.readyState);
      console.log("Audio element paused:", audioElement.paused);
      console.log("Audio element current time:", audioElement.currentTime);
      console.log("Audio element duration:", audioElement.duration);
      
      audioElement.volume = newVolume / 100;
      
      // Force unmute if needed
      if (audioElement.muted) {
        console.log("Audio was muted, unmuting...");
        audioElement.muted = false;
      }
      
      console.log("New audio element volume:", audioElement.volume);
      console.log("===================");
    } else {
      console.error("No audio element found when trying to update volume");
    }
  };
  
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  // Gérer la transition des métadonnées pendant le crossfade
  useEffect(() => {
    if (isChangingSong && displayedSong) {
      // Sauvegarder les métadonnées actuelles
      setPreviousSongData({
        title: displayedSong.title,
        artist: displayedSong.artist,
        imageUrl: displayedSong.imageUrl || 'https://picsum.photos/100'
      });
      
      // Fade out progressif sur 3 secondes (durée typique d'un crossfade)
      setMetadataOpacity(0);
    } else if (!isChangingSong && displayedSong) {
      // Fade in progressif après le crossfade
      const timer = setTimeout(() => {
        setMetadataOpacity(1);
        // Effacer les anciennes métadonnées après le fade in
        setTimeout(() => setPreviousSongData(null), 700);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isChangingSong, displayedSong]);

  // Debug audio state when playing state changes
  useEffect(() => {
    const audioElement = getCurrentAudioElement();
    if (audioElement && currentSong) {
      console.log("=== AUDIO STATE DEBUG ===");
      console.log("isPlaying:", isPlaying);
      console.log("currentSong:", currentSong.title);
      console.log("audio paused:", audioElement.paused);
      console.log("audio volume:", audioElement.volume);
      console.log("audio muted:", audioElement.muted);
      console.log("audio src:", audioElement.src ? "loaded" : "empty");
      console.log("audio readyState:", audioElement.readyState);
      console.log("========================");
      
      // Force volume check when song changes
      if (audioElement.volume === 0 && volume > 0) {
        console.log("Detected volume mismatch, fixing...");
        updateVolumeDirectly(volume);
      }
    }
  }, [isPlaying, currentSong, getCurrentAudioElement, volume]);

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
      console.log("Mute state changed to:", isMuted);
    }
  }, [isMuted, getCurrentAudioElement]);

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    console.log("Toggling mute to:", newMutedState);
  };

  const handleSeekCommit = (value: number[]) => {
    const newProgress = value[0];
    const audioElement = getCurrentAudioElement();
    if (audioElement && audioElement.duration && !isNaN(audioElement.duration)) {
      const newTime = (newProgress / 100) * audioElement.duration;
      if (!isNaN(newTime)) {
        audioElement.currentTime = newTime;
        setProgress(newProgress);
      }
    }
    // Fin du déplacement
    setIsSeeking(false);
    setLocalProgress(null);
  };

  const handleProgressChange = (value: number[]) => {
    // Début du déplacement
    setIsSeeking(true);
    setLocalProgress(value[0]);
  };

  // Enhanced volume change handler with better debugging
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    console.log("=== VOLUME CHANGE ===");
    console.log("Volume change requested:", newVolume);
    console.log("Current context volume:", volume);
    
    // Update the context volume
    setVolume(newVolume);
    
    // Also update the actual audio element volume directly
    updateVolumeDirectly(newVolume);
    
    // Verify the change took effect
    setTimeout(() => {
      const audioElement = getCurrentAudioElement();
      if (audioElement) {
        console.log("Volume verification - expected:", newVolume / 100, "actual:", audioElement.volume);
        if (Math.abs(audioElement.volume - (newVolume / 100)) > 0.01) {
          console.warn("Volume mismatch detected, retrying...");
          audioElement.volume = newVolume / 100;
        }
      }
      console.log("====================");
    }, 100);
  };

  // Enhanced play/pause with audio verification
  const handlePlayPause = () => {
    if (currentSong && isAudioReady) {
      console.log("=== PLAY/PAUSE DEBUG ===");
      const audioElement = getCurrentAudioElement();
      if (audioElement) {
        console.log("Audio element state before action:");
        console.log("- paused:", audioElement.paused);
        console.log("- volume:", audioElement.volume);
        console.log("- muted:", audioElement.muted);
        console.log("- src:", audioElement.src ? "loaded" : "empty");
        console.log("- readyState:", audioElement.readyState);
        
        // Force volume check before playing
        if (audioElement.volume === 0 && volume > 0) {
          console.log("Fixing zero volume before play");
          audioElement.volume = volume / 100;
        }
        
        if (audioElement.muted && !isMuted) {
          console.log("Fixing muted state before play");
          audioElement.muted = false;
        }
      }
      console.log("========================");
      
      isPlaying ? pause() : play(currentSong);
    } else if (!isAudioReady) {
      toast.info("Chargement de l'audio en cours...", {
        duration: 2000
      });
    }
  };

  // Format time helper function
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Navigate to synced lyrics
  const handleLyricsNavigation = () => {
    // Sauvegarder la position de scroll
    sessionStorage.setItem(`scroll-${location.pathname}`, window.scrollY.toString());
    navigate("/synced-lyrics", { state: { from: location.pathname + location.search } });
  };

  // Handle favorite toggle with proper error handling
  const handleFavoriteToggle = async () => {
    if (!currentSong) {
      toast.error(t('player.noSongSelected'));
      return;
    }

    try {
      console.log("=== FAVORITE TOGGLE DEBUG ===");
      console.log("Current song:", currentSong);
      console.log("Current favorites count:", favorites.length);
      console.log("Is currently favorite:", favorites.some(fav => fav.id === currentSong.id));
      
      await toggleFavorite(currentSong);
      
      console.log("Favorite toggle completed");
      console.log("==============================");
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error("Erreur lors de la modification des favoris");
    }
  };

  const handleNavigateToFullScreen = (e: React.MouseEvent) => {
    // Prevent navigation when clicking on buttons
    if (e.target instanceof HTMLElement && e.target.closest('button')) {
      e.stopPropagation();
      return;
    }
    navigate("/synced-lyrics");
  };

  const handleMobilePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    handlePlayPause();
  };

  const handleMobileFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleFavoriteToggle();
  };

  if (isMobile) {
    return (
      <div 
        className="fixed bottom-0 left-0 right-0 h-[88px] bg-spotify-dark/90 backdrop-blur-lg border-t border-spotify-border z-50"
        onClick={handleNavigateToFullScreen}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <Slider
            value={localProgress !== null ? [localProgress] : [progress]}
            max={100}
            step={0.1}
            onValueChange={handleProgressChange}
            onValueCommit={handleSeekCommit}
            disabled={!currentSong}
            className={cn(
              "absolute top-0 w-full h-4", // Augmente la zone tactile
              // Style de la barre
              "[&>span:first-of-type]:h-[3px]",
              // Style de la progression (remplissage)
              "[&>span:first-of-type_>span]:bg-spotify-accent",
              // Style de la poignée
              "[&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:opacity-100"
            )}
          />
        </div>

        <div className="p-2 h-full">
          <div className="flex items-center justify-between h-full gap-4">
            <div className="flex items-center gap-3 overflow-hidden flex-1">
              {displayedSong?.imageUrl && (
                <img
                  src={displayedSong.imageUrl}
                  alt="Current Song"
                  className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                />
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-base font-semibold text-white truncate">{displayedSong?.title || "No song playing"}</span>
                <span className="text-sm text-spotify-neutral truncate">{displayedSong?.artist || "..."}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 pr-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMobileFavoriteToggle}
                disabled={!currentSong}
                className="p-0 h-8 w-8"
              >
                <Heart className={cn(
                  "w-6 h-6", 
                  favorites.some(fav => fav.id === currentSong?.id) 
                    ? "text-red-500 fill-red-500" 
                    : "text-spotify-neutral"
                )} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 p-0"
                onClick={handleMobilePlayPause}
                disabled={!currentSong || (!isAudioReady && !isChangingSong)}
              >
                {!isAudioReady && currentSong ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-6 w-6 text-white" />
                ) : (
                  <Play className="h-6 w-6 text-white" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-spotify-dark border-t border-spotify-border z-50 hidden md:block">
      {/* Overlay de chargement seulement pendant le changement de musique */}
      {isChangingSong && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="flex items-center gap-3 bg-spotify-dark/80 px-4 py-2 rounded-full border border-spotify-border">
            <div className="w-4 h-4 border-2 border-spotify-accent border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-white font-medium">
              Chargement de la musique...
            </span>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between p-4 max-w-screen-2xl mx-auto">
        {displayedSong ? (
          <div className="flex items-center space-x-4 w-56 overflow-hidden relative">
            {/* Anciennes métadonnées (fade out) */}
            {previousSongData && isChangingSong && (
              <div 
                className="absolute inset-0 flex items-center space-x-4 transition-opacity duration-[3000ms] ease-out"
                style={{ opacity: 1 - metadataOpacity }}
              >
                <div className="w-16 h-16 rounded overflow-hidden shadow-md flex-shrink-0">
                  <img
                    src={previousSongData.imageUrl}
                    alt="Previous album art"
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white truncate">{previousSongData.title}</span>
                  <span className="text-xs text-spotify-neutral truncate">{previousSongData.artist}</span>
                </div>
              </div>
            )}
            
            {/* Nouvelles métadonnées (fade in) */}
            <div 
              className="flex items-center space-x-4 w-full transition-opacity duration-[3000ms] ease-in"
              style={{ opacity: metadataOpacity }}
            >
              <div className="w-16 h-16 rounded overflow-hidden shadow-md flex-shrink-0">
                <img
                  src={displayedSong.imageUrl || 'https://picsum.photos/100'}
                  alt="Current Song"
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              </div>
              <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                <span className="text-sm font-semibold text-white truncate">{displayedSong?.title || "No song playing"}</span>
                <span className="text-xs text-spotify-neutral truncate">{displayedSong?.artist || 'Unknown Artist'}</span>
              </div>
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
              className={cn(
                "w-6 h-6 transition-colors cursor-pointer",
                (isChangingSong || !isAudioReady)
                  ? "text-spotify-neutral/50 cursor-not-allowed"
                  : "text-spotify-neutral hover:text-white"
              )}
              onClick={async () => {
                if (!isChangingSong && isAudioReady) {
                  await previousSong();
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 p-0 rounded-full bg-white hover:bg-white/10"
              onClick={handlePlayPause}
              disabled={!currentSong || (!isAudioReady && !isChangingSong)}
            >
              {!isAudioReady && currentSong ? (
                <Loader2 className="h-6 w-6 text-black animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-6 w-6 text-black" />
              ) : (
                <Play className="h-6 w-6 text-black" />
              )}
            </Button>
            <SkipForward
              className={cn(
                "w-6 h-6 transition-colors cursor-pointer",
                (isChangingSong || !isAudioReady)
                  ? "text-spotify-neutral/50 cursor-not-allowed" 
                  : "text-spotify-neutral hover:text-white"
              )}
              onClick={async () => {
                if (!isChangingSong && isAudioReady) {
                  await nextSong();
                }
              }}
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
            <span className="text-xs text-spotify-neutral w-12 text-right">
              {formatTime((getCurrentAudioElement()?.currentTime || 0))}
            </span>
            <Slider
              value={localProgress !== null ? [localProgress] : [progress]}
              max={100}
              step={0.1}
              className="flex-1"
              onValueChange={handleProgressChange}
              onValueCommit={handleSeekCommit}
              disabled={isChangingSong || !currentSong || !isAudioReady}
            />
            <span className="text-xs text-spotify-neutral w-12">
              {formatTime(getCurrentAudioElement()?.duration || 0)}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4 w-48">
          <CastButton />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLyricsNavigation}
            disabled={!currentSong}
            className="text-spotify-neutral hover:text-white transition-colors"
            data-lyrics-button="true"
          >
            <Mic className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFavoriteToggle}
            disabled={!currentSong}
            className="text-spotify-neutral hover:text-white transition-colors"
          >
            <Heart className={cn(
              "w-5 h-5 transition-colors cursor-pointer", 
              favorites.some(fav => fav.id === currentSong?.id) 
                ? "text-red-500 fill-red-500" 
                : "text-spotify-neutral hover:text-white"
            )} />
          </Button>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="p-0 h-auto w-auto"
            >
              <Volume2 className={cn("w-4 h-4", isMuted ? "text-red-500" : "text-spotify-neutral")} />
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
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