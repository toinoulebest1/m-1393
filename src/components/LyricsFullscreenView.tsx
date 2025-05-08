
import React, { useState, useEffect } from "react";
import { X, Music, Loader2, Maximize, Minimize, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { usePlayer } from "@/contexts/PlayerContext";
import { Slider } from "@/components/ui/slider";

// Define the Song interface since we can't import it from PlayerContext
interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  imageUrl?: string;
  bitrate?: string;
  genre?: string;
}

interface LyricsFullscreenViewProps {
  song: Song | null;
  onClose: () => void;
}

export const LyricsFullscreenView: React.FC<LyricsFullscreenViewProps> = ({
  song,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationStage, setAnimationStage] = useState<"entry" | "content" | "exit">("entry");
  const [fullscreen, setFullscreen] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [entryAnimationTimeout, setEntryAnimationTimeout] = useState<number | null>(null);
  const [contentAnimationVisible, setContentAnimationVisible] = useState(false);
  const [renderCount, setRenderCount] = useState(0);

  // Intégration du contexte Player pour contrôler la lecture
  const { 
    isPlaying, 
    progress, 
    volume,
    play,
    pause,
    setProgress,
    nextSong,
    previousSong
  } = usePlayer();

  // Détection de Firefox au montage du composant
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsFirefox(userAgent.indexOf('firefox') > -1);
  }, []);

  // Query to fetch lyrics from the database
  const { data: lyrics, isLoading, refetch } = useQuery({
    queryKey: ["lyrics", song?.id],
    queryFn: async () => {
      if (!song?.id) return null;
      
      console.log("Fetching lyrics for song ID:", song.id);
      const { data, error } = await supabase
        .from("lyrics")
        .select("content")
        .eq("song_id", song.id)
        .maybeSingle();

      if (error) throw error;
      return data?.content || null;
    },
    enabled: !!song?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    retry: 1,
  });

  // Force a render to ensure animations trigger properly
  useEffect(() => {
    setRenderCount(prev => prev + 1);
    console.log(`Rendering lyrics component: render #${renderCount + 1}`);
  }, []);

  // Function to generate lyrics
  const generateLyrics = async () => {
    if (!song?.title || !song?.artist) {
      setError("Impossible de récupérer les paroles sans le titre et l'artiste.");
      toast.error("Impossible de récupérer les paroles sans le titre et l'artiste.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await supabase.functions.invoke("generate-lyrics", {
        body: { songTitle: song.title, artist: song.artist },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const { error: insertError } = await supabase
        .from("lyrics")
        .upsert({
          song_id: song.id,
          content: response.data.lyrics,
        });

      if (insertError) {
        throw insertError;
      }

      await refetch();
      toast.success("Les paroles ont été récupérées avec succès");
    } catch (error) {
      console.error("Error generating lyrics:", error);
      setError(error.message || "Impossible de récupérer les paroles");
      toast.error(error.message || "Impossible de récupérer les paroles");
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle fullscreen function with improved Firefox compatibility
  const toggleFullscreen = () => {
    try {
      if (!fullscreen) {
        // Trying to enter fullscreen
        const element = document.documentElement;
        
        // Firefox spécifique
        if (isFirefox) {
          if ((element as any).mozRequestFullScreen) {
            (element as any).mozRequestFullScreen();
            console.log("Requesting fullscreen mode in Firefox");
          } else {
            throw new Error("Firefox fullscreen API not available");
          }
        } else {
          // Pour les autres navigateurs
          const requestFullscreen = element.requestFullscreen || 
                               (element as any).webkitRequestFullscreen || 
                               (element as any).msRequestFullscreen;
          
          if (requestFullscreen) {
            requestFullscreen.call(element);
            console.log("Requesting fullscreen mode");
          } else {
            throw new Error("Fullscreen API not available in this browser");
          }
        }
      } else {
        // Exiting fullscreen
        if (isFirefox) {
          if ((document as any).mozCancelFullScreen) {
            (document as any).mozCancelFullScreen();
            console.log("Exiting Firefox fullscreen mode");
          }
        } else {
          const exitFullscreen = document.exitFullscreen || 
                              (document as any).webkitExitFullscreen || 
                              (document as any).msExitFullscreen;
          
          if (exitFullscreen) {
            exitFullscreen.call(document);
            console.log("Exiting fullscreen mode");
          }
        }
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
      // Fallback pour Firefox - utiliser un mode "pseudo-plein écran" CSS en cas d'échec
      setFullscreen(!fullscreen);
      toast.info(isFirefox ? 
        "Mode plein écran simulé pour Firefox" : 
        "Mode plein écran non supporté par votre navigateur"
      );
    }
  };

  // Handle fullscreen change events with improved Firefox compatibility
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreenNow = !!(
        document.fullscreenElement || 
        (document as any).mozFullScreenElement ||
        (document as any).webkitFullscreenElement || 
        (document as any).msFullscreenElement
      );
      
      console.log("Fullscreen state changed:", isFullscreenNow);
      setFullscreen(isFullscreenNow);
    };

    // Add multiple event listeners for cross-browser compatibility
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      // Remove all listeners when component unmounts
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // IMPROVED animation sequence with proper timing and guaranteed transition
  useEffect(() => {
    // Clear any existing timeouts to prevent race conditions
    if (entryAnimationTimeout !== null) {
      clearTimeout(entryAnimationTimeout);
    }
    
    console.log(`Animation starting: stage=${animationStage}, song=${song?.title}`);
    
    // Force entry animation state on component mount
    setAnimationStage("entry");
    setAnimationComplete(false);
    setContentAnimationVisible(false);
    
    // Transition to content stage after entry animation completes
    const timeout = window.setTimeout(() => {
      console.log("Animation stage: switching to content");
      setAnimationStage("content");
      
      // Set content visible with short delay to ensure CSS transition happens
      setTimeout(() => {
        setContentAnimationVisible(true);
        console.log("Content animation now visible");
        
        // Mark animation complete after all transitions finish
        setTimeout(() => {
          setAnimationComplete(true);
          console.log("Animation complete");
        }, 300);
      }, 50);
    }, 300); // Slightly shorter delay to make sure animation feels responsive
    
    // Store timeout ID for cleanup
    setEntryAnimationTimeout(timeout);

    // Handle escape key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (entryAnimationTimeout !== null) {
        clearTimeout(entryAnimationTimeout);
      }
    };
  }, [song?.id]); // Reset animation when song changes
  
  // Handle close button click with animation
  const handleClose = () => {
    console.log("Close button clicked, starting exit animation");
    setAnimationStage("exit");
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Formatage du temps pour afficher la progression de la lecture
  const formatTime = (progress: number) => {
    if (!song) return "0:00";
    
    try {
      if (song.duration && song.duration.includes(':')) {
        const [minutes, seconds] = song.duration.split(':').map(Number);
        if (isNaN(minutes) || isNaN(seconds)) return "0:00";
        
        const totalSeconds = minutes * 60 + seconds;
        const currentTime = (progress / 100) * totalSeconds;
        const currentMinutes = Math.floor(currentTime / 60);
        const currentSeconds = Math.floor(currentTime % 60);
        
        return `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
      }
      
      const duration = parseFloat(song.duration);
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

  // Ensure song data is populated
  const songTitle = song?.title || "Titre inconnu";
  const songArtist = song?.artist || "Artiste inconnu";
  const songImage = song?.imageUrl || "/placeholder.svg";

  return (
    <div className={cn(
      "fixed inset-0 z-[100] bg-black bg-opacity-95 flex flex-col",
      fullscreen && isFirefox ? "firefox-fullscreen" : "",
      animationStage === "entry" ? "animate-fade-in" : 
      animationStage === "exit" ? "opacity-0 transition-opacity duration-300" : 
      "opacity-100"
    )}
    style={{
      // Force hardware acceleration
      transform: "translateZ(0)",
      backfaceVisibility: "hidden"
    }}>
      {/* Header with close and fullscreen buttons */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="text-white hover:bg-white/10 rounded-full"
          title={fullscreen ? "Quitter le plein écran" : "Afficher en plein écran"}
        >
          {fullscreen ? (
            <Minimize className="w-6 h-6" />
          ) : (
            <Maximize className="w-6 h-6" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-white/10 rounded-full"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Main content container */}
      <div className={cn(
        "flex flex-col md:flex-row h-screen w-full p-4 md:p-6 overflow-hidden", 
        fullscreen && isFirefox ? "firefox-content" : ""
      )}>
        {/* Left side - Song information with animation */}
        <div 
          className={cn(
            "flex flex-col items-center md:items-start justify-center transition-all duration-500 ease-out",
            animationStage === "content" && contentAnimationVisible
              ? "md:w-1/3 h-[30%] md:h-full md:pr-8 opacity-100 transform scale-100" 
              : "md:w-full h-[30%] md:h-full transform scale-95 opacity-90"
          )}
          style={{ 
            transitionDelay: animationStage === "content" ? "50ms" : "0ms",
            // Force hardware acceleration
            transform: contentAnimationVisible ? 
              "translateZ(0) scale(1)" : 
              "translateZ(0) scale(0.95)"
          }}
        >
          {songImage && (
            <div className="relative mb-4 md:mb-6 transition-all duration-500 ease-out">
              <img
                src={songImage}
                alt={`${songTitle} - Album art`}
                className={cn(
                  "rounded-lg shadow-lg transition-all duration-500 ease-out object-cover",
                  animationStage === "content" && contentAnimationVisible
                    ? "md:w-64 md:h-64 w-44 h-44 opacity-100" 
                    : "w-32 h-32 opacity-90"
                )}
                style={{
                  transitionDelay: animationStage === "content" ? "100ms" : "0ms"
                }}
                onLoad={() => console.log("Album image loaded")}
                onError={(e) => {
                  console.error("Failed to load album image");
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br from-spotify-accent/30 to-transparent rounded-lg transition-opacity duration-700",
                contentAnimationVisible ? "opacity-70" : "opacity-0"
              )} />
            </div>
          )}
          
          <div className={cn(
            "text-center md:text-left transition-all duration-500 w-full px-4 md:px-0",
            animationStage === "content" && contentAnimationVisible
              ? "opacity-100 transform translate-y-0" 
              : "opacity-0 transform translate-y-4"
          )}
          style={{
            transitionDelay: animationStage === "content" ? "150ms" : "0ms"
          }}
          >
            <h1 className="text-xl md:text-3xl font-bold text-white mb-2 break-words">
              {songTitle}
            </h1>
            <p className="text-lg md:text-xl text-spotify-neutral break-words">
              {songArtist}
            </p>
          </div>
          
          {/* Nouvelle barre de lecture en dessous de l'image */}
          <div className={cn(
            "w-full mt-4 transition-all duration-500",
            animationStage === "content" && contentAnimationVisible
              ? "opacity-100 transform translate-y-0" 
              : "opacity-0 transform translate-y-4"
          )}
          style={{
            transitionDelay: animationStage === "content" ? "200ms" : "0ms"
          }}>
            {/* Affichage de la progression */}
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-spotify-neutral">{formatTime(progress)}</span>
              <span className="text-spotify-neutral">{formatDuration(song?.duration)}</span>
            </div>
            
            {/* Barre de progression */}
            <div className="flex items-center">
              <Slider
                value={[progress]}
                max={100}
                step={1}
                className="flex-grow"
                onValueChange={(value) => setProgress(value[0])}
              />
              
              {/* Contrôles de lecture à droite de la barre */}
              <div className="flex items-center ml-4 space-x-3">
                <Button 
                  variant="ghost"
                  size="icon"
                  onClick={previousSong}
                  className="text-white hover:bg-white/10 rounded-full h-8 w-8 p-1"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => isPlaying ? pause() : play()}
                  className="bg-white text-black hover:bg-white/90 rounded-full h-8 w-8 flex items-center justify-center p-1"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextSong}
                  className="text-white hover:bg-white/10 rounded-full h-8 w-8 p-1"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Generate lyrics button (only shown when no lyrics) */}
            {!lyrics && !isLoading && !error && (
              <Button
                onClick={generateLyrics}
                disabled={isGenerating || !song?.artist}
                className="mt-4 md:mt-6 animate-fade-in w-full"
                variant="outline"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Music className="h-4 w-4 mr-2" />
                )}
                Récupérer les paroles
              </Button>
            )}
          </div>
        </div>

        {/* Right side - Lyrics content with proper overflow handling */}
        <div 
          className={cn(
            "flex-grow transition-all duration-500 ease-out h-[70%] md:h-full md:max-h-full overflow-hidden",
            animationStage === "content" && contentAnimationVisible
              ? "opacity-100 transform translate-y-0 md:w-2/3 md:pl-8 md:border-l border-white/10" 
              : "opacity-0 transform translate-y-4"
          )}
          style={{
            transitionDelay: animationStage === "content" ? "200ms" : "0ms",
            // Force hardware acceleration
            transform: contentAnimationVisible ? 
              "translateZ(0) translateY(0)" : 
              "translateZ(0) translateY(16px)"
          }}
        >
          <div className="h-full w-full flex flex-col">
            {isLoading ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center">
                <Loader2 className="h-12 w-12 animate-spin text-spotify-accent mb-4" />
                <span className="text-lg text-spotify-neutral">Chargement des paroles...</span>
              </div>
            ) : lyrics ? (
              <div className="w-full h-full flex items-start justify-center overflow-hidden">
                <div className="w-full h-full max-w-3xl overflow-y-auto rounded-md p-4 md:p-6 animate-fade-in">
                  <div className="whitespace-pre-line text-spotify-neutral text-base md:text-xl leading-relaxed">
                    {lyrics}
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="flex-grow max-w-3xl mx-auto w-full p-6 animate-fade-in">
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Erreur</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                
                <Button
                  onClick={generateLyrics}
                  disabled={isGenerating || !song?.artist}
                  className="mt-4"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Music className="h-4 w-4 mr-2" />
                  )}
                  Réessayer
                </Button>
              </div>
            ) : (
              <div className="flex-grow text-center p-4 md:p-6 w-full animate-fade-in">
                <p className="text-spotify-neutral text-lg md:text-xl mb-6">Aucune parole disponible pour cette chanson.</p>
                
                <Button
                  onClick={generateLyrics}
                  disabled={isGenerating || !song?.artist}
                  variant="outline"
                  className="mx-auto"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Music className="h-4 w-4 mr-2" />
                  )}
                  Récupérer les paroles
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="next-song-alert"
        className="fixed bottom-28 right-4 bg-spotify-dark/90 text-white p-3 rounded-lg shadow-lg transition-all duration-300 transform opacity-0 translate-y-2 z-50"
      >
        <p className="text-xs text-spotify-neutral">À suivre :</p>
        <p id="next-song-title" className="font-medium"></p>
        <p id="next-song-artist" className="text-sm text-spotify-neutral"></p>
      </div>

      {/* Fix for the style tag */}
      <style>
        {`
        .firefox-fullscreen {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 9999 !important;
        }
        
        .firefox-content {
          height: 100vh !important;
          width: 100vw !important;
        }

        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        `}
      </style>
    </div>
  );
};
