import React, { useEffect, useState } from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, Music, Loader2, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { LrcPlayer } from "@/components/LrcPlayer";
import { parseLrc } from "@/utils/lrcParser";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { extractDominantColor } from "@/utils/colorExtractor";

export const SyncedLyricsView: React.FC = () => {
  const { currentSong, progress, isPlaying, play, pause, nextSong, previousSong, setProgress } = usePlayer();
  const navigate = useNavigate();
  const [parsedLyrics, setParsedLyrics] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [lyricsText, setLyricsText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [accentColor, setAccentColor] = useState<[number, number, number] | null>(null);
  const [animationStage, setAnimationStage] = useState<"entry" | "exit">("entry");
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [isChangingSong, setIsChangingSong] = useState<boolean>(false);

  // Default colors for songs without image or during loading
  const DEFAULT_COLORS = {
    dark: [48, 12, 61] as [number, number, number],
    accent: [75, 20, 95] as [number, number, number]
  };

  // Calculate current time based on progress percentage
  useEffect(() => {
    if (!currentSong || !currentSong.duration) return;
    
    let duration: number;
    
    // Convert duration from MM:SS format to seconds
    if (typeof currentSong.duration === 'string' && currentSong.duration.includes(':')) {
      const [minutes, seconds] = currentSong.duration.split(':').map(Number);
      duration = minutes * 60 + seconds;
    } else {
      duration = parseFloat(String(currentSong.duration));
    }
    
    // Calculate current time in seconds
    const time = (progress / 100) * duration;
    setCurrentTime(time);
    
  }, [currentSong, progress]);

  // Animation effects setup
  useEffect(() => {
    setAnimationStage("entry");
    
    // Handle escape key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  
  // Extract colors from the album art
  useEffect(() => {
    const extractColors = async () => {
      if (currentSong?.imageUrl && !currentSong.imageUrl.includes('placeholder')) {
        try {
          const dominantRgb = await extractDominantColor(currentSong.imageUrl);
          
          if (dominantRgb) {
            setDominantColor(dominantRgb);
            
            // Create a more vibrant accent color
            const accentRgb: [number, number, number] = [
              Math.min(255, dominantRgb[0] * 1.4),
              Math.min(255, dominantRgb[1] * 1.4),
              Math.min(255, dominantRgb[2] * 1.4)
            ];
            setAccentColor(accentRgb);
            
            console.log('Extracted colors:', {dominant: dominantRgb, accent: accentRgb});
          } else {
            // Fallback colors
            setDominantColor(DEFAULT_COLORS.dark);
            setAccentColor(DEFAULT_COLORS.accent);
          }
        } catch (error) {
          console.error('Error extracting colors:', error);
          setDominantColor(DEFAULT_COLORS.dark);
          setAccentColor(DEFAULT_COLORS.accent);
        }
      } else {
        setDominantColor(DEFAULT_COLORS.dark);
        setAccentColor(DEFAULT_COLORS.accent);
      }
    };
    
    extractColors();
  }, [currentSong?.imageUrl]);

  // Detect song change and show loading overlay if applicable
  useEffect(() => {
    if (currentSong && currentSong.id !== currentSongId) {
      setIsChangingSong(true); // Début du changement de chanson
      setParsedLyrics(null);
      setLyricsText(null);
      setError(null);
      setIsLoadingLyrics(true);
      setCurrentSongId(currentSong.id);
      fetchLyrics(currentSong.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id]);

  // Lorsque les paroles (lyrics) sont chargées, enlever l'overlay de chargement
  useEffect(() => {
    // Retirer l'overlay si on arrête de loader ET qu'on a song et ses paroles (ou message d'erreur)
    if (isChangingSong && !isLoadingLyrics) {
      // Petite latence visuelle si besoin
      setTimeout(() => setIsChangingSong(false), 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingLyrics]);

  // Function to fetch lyrics
  const fetchLyrics = async (songId: string) => {
    if (!songId) {
      setIsLoadingLyrics(false);
      return;
    }
    
    try {
      console.log('SyncedLyricsView: Fetching lyrics for song ID:', songId);
      
      // Get lyrics from Supabase
      const { data, error } = await supabase
        .from('lyrics')
        .select('content')
        .eq('song_id', songId)
        .single();
        
      if (error || !data) {
        console.log('SyncedLyricsView: No lyrics found in database');
        setIsLoadingLyrics(false);
        return;
      }
      
      const lyrics = data.content;
      setLyricsText(lyrics);
      
      // Parse LRC format lyrics
      try {
        const parsed = parseLrc(lyrics);
        console.log('SyncedLyricsView: Successfully parsed lyrics:', parsed);
        setParsedLyrics(parsed);
      } catch (parseError) {
        console.error('SyncedLyricsView: Error parsing lyrics', parseError);
        // Still show raw lyrics text even if parsing fails
      }
    } catch (error) {
      console.error('SyncedLyricsView: Error fetching lyrics', error);
    } finally {
      setIsLoadingLyrics(false);
    }
  };

  const handleClose = () => {
    setAnimationStage("exit");
    setTimeout(() => {
      navigate(-1);
    }, 150);
  };

  // Format time for display
  const formatTime = (progress: number) => {
    if (!currentSong?.duration) return "0:00";
    
    try {
      let totalSeconds = 0;
      if (currentSong.duration.includes(':')) {
        const [minutes, seconds] = currentSong.duration.split(':').map(Number);
        if (!isNaN(minutes) && !isNaN(seconds)) {
          totalSeconds = minutes * 60 + seconds;
        }
      } else {
        const duration = parseFloat(currentSong.duration);
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
  };

  // Format duration for display
  const formatDuration = (duration: string | undefined) => {
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
  };

  // Function to handle play/pause
  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const generateLyrics = async () => {
    if (!currentSong?.artist) {
      setError("Impossible de récupérer les paroles sans le nom de l'artiste.");
      toast.error("Impossible de récupérer les paroles sans le nom de l'artiste.");
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    try {
      console.log('Generating lyrics for:', currentSong.title, 'by', currentSong.artist);
      const response = await supabase.functions.invoke('generate-lyrics', {
        body: { songTitle: currentSong.title, artist: currentSong.artist },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log('Generated lyrics response:', response.data);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const lyricsContent = response.data.lyrics;
      
      // Save lyrics to database
      const { error: insertError } = await supabase
        .from('lyrics')
        .upsert({
          song_id: currentSong.id,
          content: lyricsContent,
        });

      if (insertError) {
        throw insertError;
      }

      // Refresh lyrics
      setLyricsText(lyricsContent);
      try {
        const parsed = parseLrc(lyricsContent);
        setParsedLyrics(parsed);
      } catch (e) {
        console.log('Lyrics are not in LRC format');
      }
      
      toast.success("Les paroles ont été récupérées avec succès");
    } catch (error: any) {
      console.error('Error generating lyrics:', error);
      setError(error.message || "Impossible de récupérer les paroles");
      toast.error(error.message || "Impossible de récupérer les paroles");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentSong) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-spotify-dark to-black p-4">
        <div className="text-center">
          <Mic className="w-12 h-12 text-spotify-accent mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Pas de chanson en cours</h2>
          <p className="text-spotify-neutral mb-6">Lancez une chanson pour voir les paroles synchronisées</p>
          <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  // Chargement/changement de chanson
  {isChangingSong && (
    <div className="absolute z-50 inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md transition-all animate-fade-in">
      <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-background/80 shadow-lg border border-white/10">
        <Loader2 className="h-8 w-8 text-spotify-accent animate-spin" />
        <span className="text-lg font-semibold text-white">
          Changement de chanson...
        </span>
        <span className="text-sm text-muted-foreground">
          Veuillez patienter pendant le chargement des nouvelles paroles.
        </span>
      </div>
    </div>
  )}

  // Background style based on extracted colors
  const bgStyle = dominantColor ? {
    background: `radial-gradient(circle at center, 
      rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.8) 0%, 
      rgba(0, 0, 0, 0.95) 100%)`,
    willChange: 'transform',
    transform: 'translateZ(0)',
  } : {};

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex flex-col",
      animationStage === "entry" ? "animate-fade-in" : "opacity-0 transition-opacity duration-200"
    )}>
      {/* Background with album art color */}
      <div 
        className="absolute inset-0 z-0"
        style={bgStyle}
      >
        {/* Blur overlay */}
        <div 
          className="absolute inset-0 z-1 bg-black bg-opacity-40"
          style={{
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
          }}
        />

        {/* Light spot */}
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

      {/* Content */}
      <div className="flex flex-col md:flex-row h-screen w-full p-4 md:p-6 overflow-hidden relative z-10">
        {/* Left side - Song information */}
        <div className="flex flex-col items-center md:items-start justify-center md:w-1/3 h-[30%] md:h-full md:pr-8">
          {/* Song image */}
          {currentSong.imageUrl && (
            <div className="relative mb-4 md:mb-6">
              <img
                src={currentSong.imageUrl}
                alt={`${currentSong.title} - Album art`}
                className="rounded-lg shadow-lg md:w-64 md:h-64 w-44 h-44 object-cover"
                loading="eager"
                style={{
                  boxShadow: accentColor ? `0 0 20px 2px rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 0.4)` : undefined,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-spotify-accent/30 to-transparent rounded-lg" />
            </div>
          )}
          
          {/* Player Controls - Added below image and above title/artist */}
          <div className="w-full mb-4 transition-all duration-200">
            {/* Progress display */}
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-spotify-neutral">{formatTime(progress)}</span>
              <span className="text-spotify-neutral">{formatDuration(currentSong?.duration)}</span>
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
            </div>
            
            {/* Playback controls */}
            <div className="flex items-center justify-center space-x-4 mt-4">
              <Button 
                variant="ghost"
                size="icon"
                onClick={previousSong}
                className="text-white hover:bg-white/10 rounded-full h-10 w-10"
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              
              <Button
                variant="default"
                size="icon"
                onClick={handlePlayPause}
                className="bg-white text-black hover:bg-white/90 rounded-full h-12 w-12 flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={nextSong}
                className="text-white hover:bg-white/10 rounded-full h-10 w-10"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="text-center md:text-left w-full px-4 md:px-0">
            <h1 className="text-xl md:text-3xl font-bold text-white mb-2 break-words">
              {currentSong.title}
            </h1>
            <p className="text-lg md:text-xl text-spotify-neutral break-words">
              {currentSong.artist}
            </p>
          </div>
          
          {/* Generate lyrics button (only shown when no lyrics) */}
          {!lyricsText && !isGenerating && (
            <Button
              onClick={generateLyrics}
              disabled={isGenerating || !currentSong.artist}
              className="mt-4 md:mt-6 animate-fade-in"
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

          {/* Back button */}
          <Button 
            onClick={handleClose} 
            variant="ghost" 
            className="mt-4 text-white/70 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </div>

        {/* Right side - Lyrics content */}
        <div className="flex-grow h-[70%] md:h-full md:max-h-full overflow-hidden md:w-2/3 md:pl-8 md:border-l border-white/10">
          <div className="h-full w-full flex flex-col">
            {isGenerating ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center">
                <Loader2 className="h-12 w-12 animate-spin text-spotify-accent mb-4" />
                <span className="text-lg text-spotify-neutral">Génération des paroles en cours...</span>
              </div>
            ) : isLoadingLyrics ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center">
                <Loader2 className="h-12 w-12 animate-spin text-spotify-accent mb-4" />
                <span className="text-lg text-spotify-neutral">Chargement des paroles...</span>
              </div>
            ) : lyricsText ? (
              <div className="w-full h-full flex items-start justify-center overflow-hidden">
                <div 
                  className="w-full h-full max-w-3xl overflow-y-auto rounded-md p-4 md:p-6 backdrop-blur-sm" 
                  style={{
                    backgroundColor: accentColor 
                      ? `rgba(${accentColor[0] * 0.15}, ${accentColor[1] * 0.15}, ${accentColor[2] * 0.15}, 0.3)`
                      : 'rgba(0, 0, 0, 0.2)'
                  }}
                >
                  {parsedLyrics && parsedLyrics.lines && parsedLyrics.lines.length > 0 ? (
                    <LrcPlayer 
                      parsedLyrics={parsedLyrics} 
                      currentTime={currentTime}
                      className="h-full text-lg"
                      accentColor={accentColor}
                    />
                  ) : (
                    <div 
                      className="whitespace-pre-line text-base md:text-lg leading-relaxed"
                      style={{
                        color: accentColor 
                          ? `rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 1)`
                          : 'var(--spotify-neutral)'
                      }}
                    >
                      {lyricsText}
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
                  disabled={isGenerating || !currentSong.artist}
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
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Mic className="w-12 h-12 text-spotify-accent mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2">
                    Pas de paroles synchronisées disponibles
                  </h2>
                  <p className="text-spotify-neutral max-w-md">
                    Cette chanson n'a pas de paroles synchronisées ou le format n'est pas pris en charge
                  </p>
                </div>
                
                <Button
                  onClick={generateLyrics}
                  disabled={isGenerating || !currentSong.artist}
                  variant="outline"
                  className="mt-6 mx-auto"
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

      {/* Styles fixes */}
      <style>
        {`
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        `}
      </style>
    </div>
  );
};
