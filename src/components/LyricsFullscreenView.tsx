import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { parseLrc, findCurrentLyricLine, isLrcFormat as checkIsLrcFormat, convertTextToLrc, ParsedLrc, LrcLine } from "@/utils/lrcParser";

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

// Default colors for songs without image or during loading
const DEFAULT_COLORS = {
  dark: [48, 12, 61] as [number, number, number],
  accent: [75, 20, 95] as [number, number, number]
};

// Cache map for extracted colors (max 20 entries)
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
  
  // Nouveaux états pour les paroles synchronisées
  const [parsedLyrics, setParsedLyrics] = useState<ParsedLrc | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [nextLines, setNextLines] = useState<LrcLine[]>([]);
  const [isLrcFormat, setIsLrcFormat] = useState(false);
  const [userScrolling, setUserScrolling] = useState(false);
  const [scrollTimeout, setScrollTimeout] = useState<number | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  
  // Correction: Utiliser useRef au lieu de useState pour l'intervalle
  const syncIntervalRef = useRef<number | null>(null);

  // Integrate Player context to control playback
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

  // Detect Firefox on component mount (only once)
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsFirefox(userAgent.indexOf('firefox') > -1);
  }, []);

  // Get current audio time from the audio element
  useEffect(() => {
    const updateCurrentTime = () => {
      const audioElement = document.querySelector('audio');
      if (audioElement) {
        setCurrentAudioTime(audioElement.currentTime);
      }
    };

    // Update time frequently when playing
    const interval = setInterval(() => {
      if (isPlaying) {
        updateCurrentTime();
      }
    }, 100);

    // Initial update
    updateCurrentTime();

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Référence à l'élément audio pour obtenir directement le temps actuel
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Amélioration: Obtenir une référence à l'élément audio et mettre à jour le temps actuel
  useEffect(() => {
    const findAudioElement = () => {
      const audioElement = document.querySelector('audio');
      if (audioElement) {
        audioRef.current = audioElement;
        // Initialiser le temps actuel
        setCurrentAudioTime(audioElement.currentTime);
      }
    };

    // Essayer de trouver l'élément audio immédiatement
    findAudioElement();

    // Si on ne le trouve pas, essayer à nouveau après un court délai
    if (!audioRef.current) {
      const timeout = setTimeout(() => {
        findAudioElement();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [song?.id]);

  // Amélioration: Synchroniser les paroles plus précisément avec la lecture
  useEffect(() => {
    const syncLyrics = () => {
      if (!audioRef.current || !isPlaying) return;
      
      // Mise à jour plus précise du temps de lecture
      setCurrentAudioTime(audioRef.current.currentTime);
    };

    // Nettoyer l'intervalle précédent si existant
    if (syncIntervalRef.current) {
      window.clearInterval(syncIntervalRef.current);
    }

    // Synchroniser plus fréquemment lorsque la musique est en lecture
    if (isPlaying && isLrcFormat && parsedLyrics) {
      syncIntervalRef.current = window.setInterval(syncLyrics, 50); // Intervalle plus court pour plus de précision
    }

    return () => {
      if (syncIntervalRef.current) {
        window.clearInterval(syncIntervalRef.current);
      }
    };
  }, [isPlaying, isLrcFormat, parsedLyrics]);

  // Optimized dominant color extraction with memoization
  const extractDominantColor = useCallback(async (imageUrl: string) => {
    // Check if color is already cached
    if (colorCache.has(imageUrl)) {
      const cachedColors = colorCache.get(imageUrl)!;
      setDominantColor(cachedColors.dominant);
      setAccentColor(cachedColors.accent);
      return;
    }

    try {
      // Use smaller image for color extraction (performance optimization)
      const smallerImageUrl = imageUrl.includes('?') 
        ? `${imageUrl}&size=100` 
        : `${imageUrl}?size=100`;
      
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = smallerImageUrl;
      });

      const colorThief = new ColorThief();
      const dominantRgb = colorThief.getColor(img) as [number, number, number];
      
      // Create a more saturated version for accent
      const accentRgb: [number, number, number] = [
        Math.min(255, dominantRgb[0] * 1.3),
        Math.min(255, dominantRgb[1] * 1.3),
        Math.min(255, dominantRgb[2] * 1.3)
      ];
      
      // Cache the extracted colors
      if (colorCache.size >= 20) {
        // Limit cache size - remove oldest entry
        const firstKey = colorCache.keys().next().value;
        colorCache.delete(firstKey);
      }
      
      colorCache.set(imageUrl, {
        dominant: dominantRgb,
        accent: accentRgb
      });
      
      setDominantColor(dominantRgb);
      setAccentColor(accentRgb);
    } catch (error) {
      // Fallback colors if extraction fails
      setDominantColor(DEFAULT_COLORS.dark);
      setAccentColor(DEFAULT_COLORS.accent);
    }
  }, []);

  // Extract color when song changes - with debounce
  useEffect(() => {
    let timeout: number;
    
    if (song?.imageUrl && !song.imageUrl.includes('placeholder')) {
      // Small delay to prioritize component mounting first
      timeout = window.setTimeout(() => {
        extractDominantColor(song.imageUrl as string);
      }, 100);
    } else {
      // Default colors if no image
      setDominantColor(DEFAULT_COLORS.dark);
      setAccentColor(DEFAULT_COLORS.accent);
    }
    
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [song?.imageUrl, extractDominantColor]);

  // Query to fetch lyrics - optimized with caching
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
        // Vérifier si les paroles sont au format LRC
        if (data) {
          // Properly call the function with the right name to avoid any confusion
          const lrcFormatDetected = checkIsLrcFormat(data);
          setIsLrcFormat(lrcFormatDetected);
          
          if (lrcFormatDetected) {
            try {
              const parsed = parseLrc(data);
              setParsedLyrics(parsed);
              console.log("Paroles LRC parsées avec succès:", parsed);
            } catch (error) {
              console.error("Erreur lors du parsing des paroles LRC:", error);
              setIsLrcFormat(false);
            }
          } else {
            setParsedLyrics(null);
          }
        }
      },
      onError: (error) => {
        console.error("Error fetching lyrics:", error);
        setIsLrcFormat(false);
        setParsedLyrics(null);
      }
    }
  });

  // OPTIMIZED: Lighter and more efficient animation
  useEffect(() => {
    setAnimationStage("entry");
    setContentVisible(false);
    
    // Shorter and more efficient timeout
    const timeout = setTimeout(() => {
      setAnimationStage("content");
      
      // Reduced delay for content display
      setTimeout(() => {
        setContentVisible(true);
      }, 10); // Reduced from 30ms
    }, 100); // Reduced from 200ms
    
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
    // Faster animation
    setTimeout(() => {
      onClose();
    }, 150); // Reduced from 200ms
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
    } catch (error: any) {
      console.error("Error generating lyrics:", error);
      setError(error.message || "Impossible de récupérer les paroles");
      toast.error(error.message || "Impossible de récupérer les paroles");
    } finally {
      setIsGenerating(false);
    }
  };

  // OPTIMIZED: Toggle fullscreen function with simplified Firefox handling
  const toggleFullscreen = useCallback(() => {
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
      // Simple fallback
      setFullscreen(!fullscreen);
    }
  }, [fullscreen, isFirefox]);

  // OPTIMIZED: Better fullscreen event handling
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

    // Add event listeners for cross-browser compatibility
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    return () => {
      // Remove all listeners on unmount
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // More performant time formatter
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

  // More performant duration formatter
  const formatDuration = useCallback((duration: string | undefined) => {
    if (!duration) return "0:00";
    
    try {
      if (duration.includes(':')) {
        return duration;
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

  // Fonction pour gérer la lecture/pause
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);
  
  // Fonctions pour gérer les changements de musique
  const handleNextSong = useCallback(() => {
    console.log("Next song clicked in lyrics view");
    nextSong();
  }, [nextSong]);
  
  const handlePreviousSong = useCallback(() => {
    console.log("Previous song clicked in lyrics view");
    previousSong();
  }, [previousSong]);

  // Fonction pour gérer le défilement des paroles
  const handleUserScroll = useCallback(() => {
    setUserScrolling(true);
    
    // Réinitialiser le scroll automatique après un certain délai
    if (scrollTimeout) {
      window.clearTimeout(scrollTimeout);
    }
    
    const timeout = window.setTimeout(() => {
      setUserScrolling(false);
    }, 5000); // 5 secondes avant de reprendre le défilement automatique
    
    setScrollTimeout(timeout);
  }, [scrollTimeout]);

  // Améliorons la synchronisation des paroles avec la musique
  useEffect(() => {
    if (!isPlaying || !parsedLyrics || !parsedLyrics.lines.length) return;
    
    // Si l'utilisateur est en train de défiler manuellement, ne pas interférer
    if (userScrolling) return;
    
    console.log("Mise à jour des paroles - Temps actuel:", currentAudioTime, "Offset:", parsedLyrics.offset);
    
    // Trouver la ligne actuelle basée sur le temps de lecture
    const { current, next } = findCurrentLyricLine(
      parsedLyrics.lines,
      currentAudioTime,
      parsedLyrics.offset || 0
    );
    
    console.log("Ligne active:", current, "Lignes suivantes:", next);
    
    // Mise à jour des états pour le rendu
    setCurrentLineIndex(current);
    setNextLines(next);
    
    // Faire défiler automatiquement vers la ligne active seulement si elle change
    if (current >= 0 && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const currentLineElement = container.querySelector(`[data-line-index="${current}"]`);
      
      if (currentLineElement) {
        // Utiliser scrollIntoView avec un comportement smooth pour une animation plus fluide
        requestAnimationFrame(() => {
          currentLineElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        });
      }
    }
  }, [currentAudioTime, isPlaying, parsedLyrics, userScrolling]);

  // Nettoyage du timeout au démontage
  useEffect(() => {
    return () => {
      if (scrollTimeout) {
        window.clearTimeout(scrollTimeout);
      }
    };
  }, [scrollTimeout]);

  // Ensure song data is populated
  const songTitle = song?.title || "Titre inconnu";
  const songArtist = song?.artist || "Artiste inconnu";
  const songImage = song?.imageUrl || "/placeholder.svg";

  // OPTIMIZED: Use useMemo for styles to calculate only once
  const bgStyle = useMemo(() => {
    if (!dominantColor) return {};
    
    // Simplified gradient with fewer color stops
    return {
      background: `radial-gradient(circle at center, 
        rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.8) 0%, 
        rgba(0, 0, 0, 0.95) 100%)`,
      willChange: 'transform',
      transform: 'translateZ(0)',
    };
  }, [dominantColor]);

  // Simplified blur style with reduced intensity
  const blurOverlayStyle = useMemo(() => ({
    backdropFilter: "blur(30px)",
    WebkitBackdropFilter: "blur(30px)",
  }), []);

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex flex-col",
      fullscreen && isFirefox ? "firefox-fullscreen" : "",
      animationStage === "entry" ? "animate-fade-in" : 
      animationStage === "exit" ? "opacity-0 transition-opacity duration-200" : 
      "opacity-100"
    )}
    style={{
      contain: 'content', // Performance optimization
      transform: "translateZ(0)", // Hardware acceleration
      willChange: "transform, opacity", // Hint to browser
    }}>
      {/* Background with album art color - SIMPLIFIED */}
      <div 
        className="absolute inset-0 z-0"
        style={bgStyle}
      >
        {/* Reduced overlay elements for better performance */}
        <div 
          className="absolute inset-0 z-1 bg-black bg-opacity-40"
          style={blurOverlayStyle}
        />

        {/* Single light spot instead of multiple */}
        {accentColor && (
          <div
            className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-10 blur-[100px]"
            style={{
              background: `radial-gradient(circle at center, rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 0.6) 0%, rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 0) 70%)`,
              willChange: 'transform',
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

      {/* Main content container - OPTIMIZED */}
      <div className={cn(
        "flex flex-col md:flex-row h-screen w-full p-4 md:p-6 overflow-hidden relative z-10", 
        fullscreen && isFirefox ? "firefox-content" : ""
      )}>
        {/* Left side - Song information with simpler animation */}
        <div 
          className={cn(
            "flex flex-col items-center md:items-start justify-center transition-all duration-200",
            animationStage === "content" && contentVisible
              ? "md:w-1/3 h-[30%] md:h-full md:pr-8 opacity-100" 
              : "md:w-full h-[30%] md:h-full opacity-90"
          )}
        >
          {songImage && (
            <div className="relative mb-4 md:mb-6 transition-all duration-200">
              <img
                src={songImage}
                alt={`${songTitle} - Album art`}
                className={cn(
                  "rounded-lg shadow-lg transition-all duration-200 object-cover",
                  animationStage === "content" && contentVisible
                    ? "md:w-64 md:h-64 w-44 h-44 opacity-100" 
                    : "w-32 h-32 opacity-90"
                )}
                loading="eager" // Force priority loading
                style={{
                  boxShadow: accentColor ? `0 0 20px 2px rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 0.4)` : undefined,
                }}
              />
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br from-spotify-accent/30 to-transparent rounded-lg transition-opacity duration-200",
                contentVisible ? "opacity-70" : "opacity-0"
              )} />
            </div>
          )}
          
          {/* Playback controls after image */}
          <div className={cn(
            "w-full mb-4 transition-all duration-200",
            animationStage === "content" && contentVisible
              ? "opacity-100" 
              : "opacity-0"
          )}>
            {/* Progress display */}
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-spotify-neutral">{formatTime(progress)}</span>
              <span className="text-spotify-neutral">{formatDuration(song?.duration)}</span>
            </div>
            
            {/* Progress bar */}
            <div className="flex items-center">
              <Slider
                value={[progress]}
                max={100}
                step={1}
                className="flex-grow"
                onValueChange={(value) => setProgress(value[0])}
              />
              
              {/* Playback controls right of the bar */}
              <div className="flex items-center ml-4 space-x-3">
                <Button 
                  variant="ghost"
                  size="icon"
                  onClick={handlePreviousSong}
                  className="text-white hover:bg-white/10 rounded-full h-8 w-8 p-1"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="default"
                  size="icon"
                  onClick={handlePlayPause}
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
                  onClick={handleNextSong}
                  className="text-white hover:bg-white/10 rounded-full h-8 w-8 p-1"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className={cn(
            "text-center md:text-left transition-all duration-200 w-full px-4 md:px-0",
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

        {/* Right side - Lyrics content with proper overflow handling - OPTIMIZED */}
        <div 
          className={cn(
            "flex-grow transition-all duration-200 h-[70%] md:h-full md:max-h-full overflow-hidden",
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
                <div 
                  className="w-full h-full max-w-3xl overflow-y-auto rounded-md p-4 md:p-6 backdrop-blur-sm bg-black/20"
                  onScroll={handleUserScroll}
                  ref={lyricsContainerRef}
                >
                  {isLrcFormat && parsedLyrics ? (
                    <div className="whitespace-pre-line text-spotify-neutral text-base md:text-xl leading-relaxed">
                      {/* Affichage des paroles synchronisées avec visualisation améliorée */}
                      {parsedLyrics.lines.map((line, index) => (
                        <div 
                          key={`${index}-${line.time}`}
                          data-line-index={index}
                          className={cn(
                            "py-2 transition-all duration-300 opacity-70",
                            currentLineIndex === index 
                              ? "text-white font-semibold text-xl md:text-2xl opacity-100 translate-x-2 border-l-4 border-spotify-accent pl-3" 
                              : nextLines.some(nextLine => nextLine.time === line.time) // Vérification plus précise
                                ? "text-spotify-neutral opacity-85"
                                : "text-spotify-neutral/60"
                          )}
                          style={{
                            // Transition plus fluide pour le changement de lignes
                            transition: 'all 0.3s ease-out',
                          }}
                        >
                          {line.text || " "} {/* Espace pour les lignes vides */}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="whitespace-pre-line text-spotify-neutral text-base md:text-xl leading-relaxed">
                      {lyrics}
                    </div>
                  )}
                </div>
              </div>
            ) : error ? (
              <div className="flex-grow max-w-3xl mx-auto w-full p-6">
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
              <div className="flex-grow text-center p-4 md:p-6 w-full">
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

      {/* Fixed inline styles - removed JSX property to fix TypeScript error */}
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

        @keyframes highlight-active {
          0%, 100% {
            border-color: rgba(137, 90, 240, 0.8);
          }
          50% {
            border-color: rgba(137, 90, 240, 1);
          }
        }
      `}
      </style>
    </div>
  );
};
