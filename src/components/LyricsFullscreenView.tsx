import React, { useState, useEffect } from "react";
import { X, Music, Loader2, Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

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
      
      const { data, error } = await supabase
        .from("lyrics")
        .select("content")
        .eq("song_id", song.id)
        .maybeSingle();

      if (error) throw error;
      return data?.content || null;
    },
    enabled: !!song?.id,
  });

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

  // Handle animation sequence
  useEffect(() => {
    // Start with entry animation
    setAnimationStage("entry");
    
    // After entry animation completes, switch to content stage
    const entryTimer = setTimeout(() => {
      setAnimationStage("content");
    }, 400);
    
    // Handle escape key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Trigger exit animation before closing
        setAnimationStage("exit");
        setTimeout(() => {
          onClose();
        }, 300);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(entryTimer);
    };
  }, [onClose]);
  
  // Handle close button click with animation
  const handleClose = () => {
    setAnimationStage("exit");
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className={cn(
      "fixed inset-0 z-[100] bg-black bg-opacity-95 flex flex-col",
      fullscreen && isFirefox ? "firefox-fullscreen" : "",
      animationStage === "entry" ? "animate-fade-in" : 
      animationStage === "exit" ? "opacity-0 transition-opacity duration-300" : 
      "opacity-100"
    )}>
      {/* Header with close and fullscreen buttons */}
      <div className="absolute top-4 right-4 flex items-center space-x-2">
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
            animationStage === "entry" 
              ? "md:w-full h-[30%] md:h-full transform scale-95 opacity-90" 
              : animationStage === "content" 
                ? "md:w-1/3 h-[30%] md:h-full md:pr-8 opacity-100 transform scale-100" 
                : "md:w-full h-[30%] md:h-full transform scale-95 opacity-50"
          )}
        >
          {song?.imageUrl && (
            <div className="relative mb-4 md:mb-6 transition-all duration-500 ease-out">
              <img
                src={song.imageUrl || "/placeholder.svg"}
                alt={`${song.title} - Album art`}
                className={cn(
                  "rounded-lg shadow-lg transition-all duration-500 ease-out object-cover",
                  animationStage === "entry" 
                    ? "w-32 h-32 opacity-90" 
                    : animationStage === "content" 
                      ? "md:w-64 md:h-64 w-44 h-44 opacity-100" 
                      : "w-32 h-32 opacity-70"
                )}
              />
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br from-spotify-accent/30 to-transparent rounded-lg transition-opacity duration-700",
                animationStage === "content" ? "opacity-70" : "opacity-0"
              )} />
            </div>
          )}
          
          <div className={cn(
            "text-center md:text-left transition-all duration-500 w-full px-4 md:px-0",
            animationStage === "entry"
              ? "opacity-0 transform translate-y-4" 
              : animationStage === "content"
                ? "opacity-100 transform translate-y-0" 
                : "opacity-0 transform -translate-y-4"
          )}>
            <h1 className="text-xl md:text-3xl font-bold text-white mb-2 break-words">
              {song?.title || "Titre inconnu"}
            </h1>
            <p className="text-lg md:text-xl text-spotify-neutral break-words">
              {song?.artist || "Artiste inconnu"}
            </p>
            
            {/* Generate lyrics button (only shown on left side when no lyrics) */}
            {!lyrics && !isLoading && !error && (
              <Button
                onClick={generateLyrics}
                disabled={isGenerating || !song?.artist}
                className="mt-4 md:mt-8"
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
            animationStage === "entry" 
              ? "opacity-0" 
              : animationStage === "content"
                ? "opacity-100 md:w-2/3 md:pl-8 md:border-l border-white/10" 
                : "opacity-0"
          )}
        >
          <div className="h-full w-full flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-12 w-12 animate-spin text-spotify-accent mb-4" />
                <span className="text-lg text-spotify-neutral">Chargement des paroles...</span>
              </div>
            ) : lyrics ? (
              <div className="w-full h-full flex items-start justify-center overflow-hidden">
                <div className="w-full h-full max-w-3xl overflow-y-auto rounded-md p-4 md:p-6">
                  <div className="whitespace-pre-line text-spotify-neutral text-base md:text-xl leading-relaxed">
                    {lyrics}
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="max-w-3xl mx-auto w-full p-6">
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
              <div className="text-center p-4 md:p-6 w-full">
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

      {/* Ajouter du CSS spécifique pour Firefox en fallback */}
      {fullscreen && isFirefox && (
        <style jsx>{`
          :global(.firefox-fullscreen) {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 9999 !important;
          }
          
          :global(.firefox-content) {
            height: 100vh !important;
            width: 100vw !important;
          }
        `}</style>
      )}
    </div>
  );
};
