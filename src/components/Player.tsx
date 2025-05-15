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
import { useLocation, useNavigate } from "react-router-dom";

export const Player = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  
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
    toggleFavorite,
    isChangingSong,
    stopCurrentSong
  } = usePlayer();
  
  // Check if the current page is the blind test page
  const isBlindTest = location.pathname === '/blind-test';
  const isSyncedLyricsPage = location.pathname === '/synced-lyrics';
  
  const positionUpdateIntervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Synchroniser audioRef avec l'Audio global du PlayerContext si possible
  useEffect(() => {
    // Récupère le joueur global (fixe pour l'app)
    if (typeof window !== "undefined" && "Audio" in window) {
      // @ts-ignore: accès au singleton "globalAudio" utilisé partout
      audioRef.current = window.globalAudio || document.querySelector('audio');
    }
  }, []);

  const [showLyrics, setShowLyrics] = useState(false);

  // Nouvelle logique : intervalle qui se base sur la vraie position de lecture,
  // et rafraîchit audioRef.current à chaque tick pour prendre la vraie source utilisée.
  useEffect(() => {
    // Clear any existing interval
    if (positionUpdateIntervalRef.current) {
      window.clearInterval(positionUpdateIntervalRef.current);
      positionUpdateIntervalRef.current = null;
    }

    if ('mediaSession' in navigator && currentSong && isPlaying) {
      positionUpdateIntervalRef.current = window.setInterval(() => {
        // Toujours forcer l'audioRef à pointer vers le vrai player global
        if (typeof window !== "undefined" && "Audio" in window) {
          // @ts-ignore
          audioRef.current = window.globalAudio || document.querySelector('audio');
        }
        let duration = 0;
        let position = 0;
        let playbackRateVal = playbackRate ?? 1;

        if (audioRef.current && !isNaN(audioRef.current.duration)) {
          duration = audioRef.current.duration;
          position = audioRef.current.currentTime;
          playbackRateVal = audioRef.current.playbackRate || playbackRateVal;
        } else {
          duration = durationToSeconds(currentSong.duration);
          // Utilisation fallback
          position = (progress / 100) * duration;
        }

        updatePositionState(duration, position, playbackRateVal);
      }, 1000);
    }

    return () => {
      if (positionUpdateIntervalRef.current) {
        window.clearInterval(positionUpdateIntervalRef.current);
      }
    };
  }, [currentSong, isPlaying, playbackRate]); // On ne remet pas progress

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
  
  // Fonction pour naviguer vers la page des paroles synchronisées
  const navigateToSyncedLyrics = () => {
    navigate('/synced-lyrics');
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
    
    // Désactiver temporairement le bouton si un changement est déjà en cours
    if (isChangingSong) {
      toast.info("Changement de piste en cours...");
      return;
    }
    
    // Stop the current song immediately before loading the next one
    stopCurrentSong();
    
    // Call the nextSong function from PlayerContext
    nextSong();
  };
  
  const handleSkipBack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Previous song button clicked");
    
    // Désactiver temporairement le bouton si un changement est déjà en cours
    if (isChangingSong) {
      toast.info("Changement de piste en cours...");
      return;
    }
    
    // Stop the current song immediately before loading the previous one
    stopCurrentSong();
    
    // Call the previousSong function from PlayerContext
    previousSong();
  };
  
  const handlePlayPause = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Play/pause button clicked");
    
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };
  
  const songInfo = getDisplayedSongInfo();
  const blurImage = shouldBlurImage();

  // Determine if the lyrics buttons should be shown (hide during blind test)
  const shouldShowLyricsButton = !isBlindTest;

  return (
    <>
      {/* La bannière "En cours de lecture" a été supprimée */}

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
                    disabled={isChangingSong}
                  >
                    <Shuffle className={cn(
                      "w-4 h-4",
                      isChangingSong && "opacity-50"
                    )} />
                  </button>
                  <button 
                    className="text-spotify-neutral hover:text-white transition-all hover:scale-110"
                    onClick={handleSkipBack}
                    disabled={isChangingSong}
                  >
                    <SkipBack className={cn(
                      "w-5 h-5",
                      isChangingSong && "opacity-50"
                    )} />
                  </button>
                  <button 
                    className={cn(
                      "bg-white rounded-full p-2 hover:scale-110 transition-all shadow-lg hover:shadow-white/20",
                      isChangingSong && "opacity-70"
                    )}
                    onClick={handlePlayPause}
                    disabled={isChangingSong}
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
                    disabled={isChangingSong}
                  >
                    <SkipForward className={cn(
                      "w-5 h-5",
                      isChangingSong && "opacity-50"
                    )} />
                  </button>
                  <button 
                    className={cn(
                      "text-spotify-neutral hover:text-white transition-all",
                      repeatMode !== 'none' && "text-spotify-accent"
                    )}
                    onClick={toggleRepeat}
                    disabled={isChangingSong}
                  >
                    {repeatMode === 'one' ? (
                      <Repeat1 className={cn(
                        "w-4 h-4",
                        isChangingSong && "opacity-50"
                      )} />
                    ) : (
                      <Repeat className={cn(
                        "w-4 h-4",
                        isChangingSong && "opacity-50"
                      )} />
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
                    disabled={isChangingSong}
                  />
                  <span className="text-xs text-spotify-neutral">{formatDuration(currentSong?.duration)}</span>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {currentSong && shouldShowLyricsButton && (
                  <>
                    {/* Bouton pour les paroles standard (modal) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "text-spotify-neutral hover:text-white transition-all",
                        showLyrics && "text-spotify-accent"
                      )}
                      onClick={toggleLyrics}
                      title="Afficher les paroles"
                      disabled={isChangingSong}
                    >
                      <Mic className="w-5 h-5" />
                    </Button>
                    
                    {/* Nouveau bouton pour les paroles synchronisées (page dédiée) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "text-spotify-neutral hover:text-white transition-all",
                        isSyncedLyricsPage && "text-spotify-accent"
                      )}
                      onClick={navigateToSyncedLyrics}
                      title="Paroles synchronisées"
                      disabled={isChangingSong}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M21 15V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                        <path d="M9 8h6" />
                        <path d="M9 12h3" />
                        <path d="m14 12 6 6" />
                        <path d="m20 12-6 6" />
                      </svg>
                    </Button>
                  </>
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
                        {songInfo.artist || '••••���•'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleFavorite}
                      className="p-1.5 hover:bg-white/5 rounded-full transition-colors"
                      disabled={isChangingSong}
                    >
                      <Heart
                        className={cn(
                          "w-4 h-4 transition-all duration-300",
                          favorites.some(s => s.id === currentSong.id)
                            ? "text-red-500 fill-red-500"
                            : "text-spotify-neutral hover:text-white",
                          isChangingSong && "opacity-50"
                        )}
                      />
                    </button>
                    
                    {/* Bouton pour les paroles standard (modal) sur mobile */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "p-1.5 text-spotify-neutral hover:text-white transition-all",
                        showLyrics && "text-spotify-accent",
                        isChangingSong && "opacity-50"
                      )}
                      onClick={toggleLyrics}
                      disabled={isChangingSong}
                    >
                      <Mic className="w-4 h-4" />
                    </Button>
                    
                    {/* Nouveau bouton pour les paroles synchronisées (page dédiée) sur mobile */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "p-1.5 text-spotify-neutral hover:text-white transition-all",
                        isSyncedLyricsPage && "text-spotify-accent",
                        isChangingSong && "opacity-50"
                      )}
                      onClick={navigateToSyncedLyrics}
                      disabled={isChangingSong}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M21 15V5a2 2 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </Button>
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
                  if (isChangingSong) return;
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
                    shuffleMode && "text-spotify-accent",
                    isChangingSong && "opacity-50"
                  )}
                  onClick={toggleShuffle}
                  disabled={isChangingSong}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>

                <button 
                  className={cn(
                    "text-spotify-neutral hover:text-white p-1.5 transition-all",
                    isChangingSong && "opacity-50"
                  )}
                  onClick={handleSkipBack}
                  disabled={isChangingSong}
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                
                <button 
                  className={cn(
                    "bg-white rounded-full p-2 hover:scale-105 transition-all",
                    isChangingSong && "opacity-70"
                  )}
                  onClick={handlePlayPause}
                  disabled={isChangingSong}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-spotify-dark" />
                  ) : (
                    <Play className="w-5 h-5 text-spotify-dark" />
                  )}
                </button>
                
                <button 
                  className={cn(
                    "text-spotify-neutral hover:text-white p-1.5 transition-all",
                    isChangingSong && "opacity-50"
                  )}
                  onClick={handleSkipForward}
                  disabled={isChangingSong}
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                
                <button 
                  className={cn(
                    "text-spotify-neutral p-1.5 hover:text-white transition-all",
                    repeatMode !== 'none' && "text-spotify-accent",
                    isChangingSong && "opacity-50"
                  )}
                  onClick={toggleRepeat}
                  disabled={isChangingSong}
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

      {/* Indicateur visuel de chargement */}
      {isChangingSong && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full z-50 flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Changement de piste...
        </div>
      )}
    </>
  );
};
