
import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import ColorThief from "colorthief";

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

// Couleurs pré-définies pour les chansons sans image ou pendant le chargement
const DEFAULT_COLORS = {
  dark: [48, 12, 61] as [number, number, number],
  accent: [75, 20, 95] as [number, number, number]
};

// Map de cache pour stocker les couleurs extraites (jusqu'à 20 entrées max)
const colorCache = new Map<string, {dominant: [number, number, number], accent: [number, number, number]}>();

export const LyricsFullscreenView: React.FC<LyricsFullscreenViewProps> = ({
  song,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationStage, setAnimationStage] = useState<"entry" | "content" | "exit">("entry");
  const [fullscreen, setFullscreen] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [accentColor, setAccentColor] = useState<[number, number, number] | null>(null);
  const [contentVisible, setContentVisible] = useState(false);

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

  // Extraction optimisée de la couleur dominante de l'image de l'album
  const extractDominantColor = useCallback(async (imageUrl: string) => {
    // Vérifier si la couleur est déjà en cache
    if (colorCache.has(imageUrl)) {
      const cachedColors = colorCache.get(imageUrl)!;
      setDominantColor(cachedColors.dominant);
      setAccentColor(cachedColors.accent);
      return;
    }

    try {
      // Utiliser une image de taille réduite pour l'extraction de couleur
      const smallerImageUrl = imageUrl.includes('?') 
        ? `${imageUrl}&size=100` 
        : `${imageUrl}?size=100`;
      
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => {
          reject(new Error("Failed to load image"));
        };
        img.src = smallerImageUrl;
      });

      const colorThief = new ColorThief();
      const dominantRgb = colorThief.getColor(img);
      
      // Ensuring the color is properly typed as a tuple
      const typedDominantRgb: [number, number, number] = [
        dominantRgb[0], 
        dominantRgb[1], 
        dominantRgb[2]
      ];
      
      // Créer une version plus saturée pour l'accent
      const accentRgb: [number, number, number] = [
        Math.min(255, typedDominantRgb[0] * 1.3),
        Math.min(255, typedDominantRgb[1] * 1.3),
        Math.min(255, typedDominantRgb[2] * 1.3)
      ];
      
      // Mettre en cache les couleurs extraites
      if (colorCache.size >= 20) {
        // Limiter la taille du cache - supprimer la plus ancienne entrée
        const firstKey = colorCache.keys().next().value;
        colorCache.delete(firstKey);
      }
      colorCache.set(imageUrl, {
        dominant: typedDominantRgb,
        accent: accentRgb
      });
      
      setDominantColor(typedDominantRgb);
      setAccentColor(accentRgb);
    } catch (error) {
      // Couleurs de secours si l'extraction échoue
      setDominantColor(DEFAULT_COLORS.dark);
      setAccentColor(DEFAULT_COLORS.accent);
    }
  }, []);

  // Extraire la couleur lorsque la chanson change
  useEffect(() => {
    if (song?.imageUrl && !song.imageUrl.includes('placeholder')) {
      extractDominantColor(song.imageUrl);
    } else {
      // Couleurs par défaut si pas d'image
      setDominantColor(DEFAULT_COLORS.dark);
      setAccentColor(DEFAULT_COLORS.accent);
    }
  }, [song?.imageUrl, extractDominantColor]);

  // Query to fetch lyrics from the database - optimisée avec mise en cache
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
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    retry: 1,
    meta: {
      onSuccess: (data) => {
        // Success callback
      },
      onError: (error) => {
        console.error("Error fetching lyrics:", error);
      }
    }
  });

  // OPTIMISÉ: Animation plus légère et plus efficace
  useEffect(() => {
    setAnimationStage("entry");
    setContentVisible(false);
    
    // Timeout plus court et plus efficace
    const timeout = setTimeout(() => {
      setAnimationStage("content");
      
      // Délai réduit pour l'affichage du contenu
      setTimeout(() => {
        setContentVisible(true);
      }, 30);
    }, 200);
    
    // Handle escape key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeout);
    };
  }, [song?.id]);
  
  // Handle close button click with animation
  const handleClose = () => {
    setAnimationStage("exit");
    setTimeout(() => {
      onClose();
    }, 200); // Animation plus rapide
  };

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

  // OPTIMISÉ: Toggle fullscreen function avec gestion de Firefox simplifiée
  const toggleFullscreen = () => {
    try {
      if (!fullscreen) {
        const element = document.documentElement;
        
        if (isFirefox && (element as any).mozRequestFullScreen) {
          (element as any).mozRequestFullScreen();
        } else {
          const requestFullscreen = element.requestFullscreen || 
                               (element as any).webkitRequestFullscreen || 
                               (element as any).msRequestFullscreen;
          
          if (requestFullscreen) {
            requestFullscreen.call(element);
          }
        }
      } else {
        if (isFirefox && (document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else {
          const exitFullscreen = document.exitFullscreen || 
                              (document as any).webkitExitFullscreen || 
                              (document as any).msExitFullscreen;
          
          if (exitFullscreen) {
            exitFullscreen.call(document);
          }
        }
      }
    } catch (err) {
      // Fallback simple
      setFullscreen(!fullscreen);
    }
  };

  // OPTIMISÉ: Meilleur gestion des événements de plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreenNow = !!(
        document.fullscreenElement || 
        (document as any).mozFullScreenElement ||
        (document as any).webkitFullscreenElement || 
        (document as any).msFullscreenElement
      );
      
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

  // Formatage du temps plus performant
  const formatTime = useCallback((progress: number) => {
    if (!song?.duration) return "0:00";
    
    try {
      let totalSeconds = 0;
      if (song.duration.includes(':')) {
        const [minutes, seconds] = song.duration.split(':').map(Number);
        if (!isNaN(minutes) && !isNaN(seconds)) {
          totalSeconds = minutes * 60 + seconds;
        }
      } else {
        const duration = parseFloat(song.duration);
        if (!isNaN(duration)) {
          totalSeconds = duration;
        }
      }
      
      const currentTime = (progress / 100) * totalSeconds;
      const currentMinutes = Math.floor(currentTime / 60);
      const currentSeconds = Math.floor(currentTime % 60);
      
      return `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
    } catch {
      return "0:00";
    }
  }, [song?.duration]);

  // Formatage de la durée plus performant
  const formatDuration = useCallback((duration: string | undefined) => {
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
    } catch {
      return "0:00";
    }
  }, []);

  // Ensure song data is populated
  const songTitle = song?.title || "Titre inconnu";
  const songArtist = song?.artist || "Artiste inconnu";
  const songImage = song?.imageUrl || "/placeholder.svg";

  // OPTIMISÉ: Utilisation de useMemo pour calculer les styles une seule fois
  const bgStyle = useMemo(() => {
    if (!dominantColor) return {};
    
    return {
      background: `radial-gradient(circle at center, 
        rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.8) 0%, 
        rgba(${dominantColor[0] * 0.6}, ${dominantColor[1] * 0.6}, ${dominantColor[2] * 0.6}, 0.95) 40%, 
        rgba(0, 0, 0, 0.98) 100%)`,
    };
  }, [dominantColor]);

  // Style pour le flou optimisé (moins intense)
  const blurOverlayStyle = useMemo(() => ({
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
  }), []);

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex flex-col",
      fullscreen && isFirefox ? "firefox-fullscreen" : "",
      animationStage === "entry" ? "animate-fade-in" : 
      animationStage === "exit" ? "opacity-0 transition-opacity duration-300" : 
      "opacity-100"
    )}
    style={{
      transform: "translateZ(0)",
      willChange: "transform, opacity", // Optimisation pour le rendu
    }}>
      {/* Background with album art color - SIMPLIFIÉ */}
      <div 
        className="absolute inset-0 z-0"
        style={bgStyle}
      >
        {/* Overlay patterns - SIMPLIFIÉ */}
        <div 
          className="absolute inset-0 z-0 opacity-30"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z' fill='%23ffffff' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E\")",
          }}
        />
        
        {/* Blur overlay - OPTIMISÉ */}
        <div 
          className="absolute inset-0 z-1 bg-black bg-opacity-40"
          style={blurOverlayStyle}
        />

        {/* Dynamic light spots - RÉDUIT */}
        {accentColor && (
          <div
            className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-10 blur-[100px]"
            style={{
              background: `radial-gradient(circle at center, rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 0.6) 0%, rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 0) 70%)`,
            }}
          />
        )}
      </div>

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

      {/* Main content container - OPTIMISÉ */}
      <div className={cn(
        "flex flex-col md:flex-row h-screen w-full p-4 md:p-6 overflow-hidden relative z-10", 
        fullscreen && isFirefox ? "firefox-content" : ""
      )}>
        {/* Left side - Song information with simpler animation */}
        <div 
          className={cn(
            "flex flex-col items-center md:items-start justify-center transition-all duration-300",
            animationStage === "content" && contentVisible
              ? "md:w-1/3 h-[30%] md:h-full md:pr-8 opacity-100" 
              : "md:w-full h-[30%] md:h-full opacity-90"
          )}
        >
          {songImage && (
            <div className="relative mb-4 md:mb-6 transition-all duration-300">
              <img
                src={songImage}
                alt={`${songTitle} - Album art`}
                className={cn(
                  "rounded-lg shadow-lg transition-all duration-300 object-cover",
                  animationStage === "content" && contentVisible
                    ? "md:w-64 md:h-64 w-44 h-44 opacity-100" 
                    : "w-32 h-32 opacity-90"
                )}
                loading="eager" // Forcer le chargement prioritaire
                style={{
                  boxShadow: accentColor ? `0 0 20px 2px rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 0.4)` : undefined,
                }}
              />
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br from-spotify-accent/30 to-transparent rounded-lg transition-opacity duration-300",
                contentVisible ? "opacity-70" : "opacity-0"
              )} />
            </div>
          )}
          
          {/* Barre de lecture après l'image */}
          <div className={cn(
            "w-full mb-4 transition-all duration-300",
            animationStage === "content" && contentVisible
              ? "opacity-100" 
              : "opacity-0"
          )}>
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
          </div>
          
          <div className={cn(
            "text-center md:text-left transition-all duration-300 w-full px-4 md:px-0",
            animationStage === "content" && contentVisible
              ? "opacity-100" 
              : "opacity-0"
          )}>
            <h1 className="text-xl md:text-3xl font-bold text-white mb-2 break-words">
              {songTitle}
            </h1>
            <p className="text-lg md:text-xl text-spotify-neutral break-words">
              {songArtist}
            </p>
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

        {/* Right side - Lyrics content with proper overflow handling - OPTIMISÉ */}
        <div 
          className={cn(
            "flex-grow transition-all duration-300 h-[70%] md:h-full md:max-h-full overflow-hidden",
            animationStage === "content" && contentVisible
              ? "opacity-100 md:w-2/3 md:pl-8 md:border-l border-white/10" 
              : "opacity-0"
          )}
        >
          <div className="h-full w-full flex flex-col">
            {isLoading ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center">
                <Loader2 className="h-12 w-12 animate-spin text-spotify-accent mb-4" />
                <span className="text-lg text-spotify-neutral">Chargement des paroles...</span>
              </div>
            ) : lyrics ? (
              <div className="w-full h-full flex items-start justify-center overflow-hidden">
                <div className="w-full h-full max-w-3xl overflow-y-auto rounded-md p-4 md:p-6 animate-fade-in backdrop-blur-sm bg-black/20">
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

      {/* CSS optimisé */}
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
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        `}
      </style>
    </div>
  );
};
