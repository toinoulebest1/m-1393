
import React, { useEffect, useState } from 'react';
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, Music, Loader2 } from "lucide-react";
import { LrcPlayer } from "@/components/LrcPlayer";
import { parseLrc } from "@/utils/lrcParser";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

export const SyncedLyricsView: React.FC = () => {
  const { currentSong, progress, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const [parsedLyrics, setParsedLyrics] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [lyricsText, setLyricsText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<[number, number, number] | null>(null);
  const [accentColor, setAccentColor] = useState<[number, number, number] | null>(null);
  const [animationStage, setAnimationStage] = useState<"entry" | "exit">("entry");

  // Default colors for songs without image or during loading
  const DEFAULT_COLORS = {
    dark: [48, 12, 61] as [number, number, number],
    accent: [75, 20, 95] as [number, number, number]
  };

  // Calcul du temps actuel basé sur le pourcentage de progression
  useEffect(() => {
    if (!currentSong || !currentSong.duration) return;
    
    let duration: number;
    
    // Convertir la durée du format MM:SS au format secondes
    if (typeof currentSong.duration === 'string' && currentSong.duration.includes(':')) {
      const [minutes, seconds] = currentSong.duration.split(':').map(Number);
      duration = minutes * 60 + seconds;
    } else {
      duration = parseFloat(String(currentSong.duration));
    }
    
    // Calculer le temps actuel en secondes
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
    if (currentSong?.imageUrl && !currentSong.imageUrl.includes('placeholder')) {
      try {
        // Default colors for now (simple implementation)
        setDominantColor([75, 20, 95]); // Purple-ish color
        setAccentColor([137, 90, 240]); // Lighter purple
      } catch (error) {
        console.error('Error extracting colors:', error);
        setDominantColor(DEFAULT_COLORS.dark);
        setAccentColor(DEFAULT_COLORS.accent);
      }
    } else {
      setDominantColor(DEFAULT_COLORS.dark);
      setAccentColor(DEFAULT_COLORS.accent);
    }
  }, [currentSong?.imageUrl]);

  // Effet pour récupérer les paroles depuis la base de données
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!currentSong) {
        setParsedLyrics(null);
        setLyricsText(null);
        return;
      }
      
      try {
        console.log('SyncedLyricsView: Récupération des paroles pour', currentSong.title);
        
        // Récupérer les paroles depuis Supabase
        const { data, error } = await supabase
          .from('lyrics')
          .select('content')
          .eq('song_id', currentSong.id)
          .single();
          
        if (error || !data) {
          console.log('SyncedLyricsView: Pas de paroles trouvées dans la base de données');
          setParsedLyrics(null);
          setLyricsText(null);
          return;
        }
        
        const lyrics = data.content;
        setLyricsText(lyrics);
        
        // Parser les paroles au format LRC
        const parsed = parseLrc(lyrics);
        setParsedLyrics(parsed);
        console.log('SyncedLyricsView: Paroles parsées', parsed);
      } catch (error) {
        console.error('SyncedLyricsView: Erreur lors du parsing des paroles', error);
        setParsedLyrics(null);
        setLyricsText(null);
      }
    };
    
    fetchLyrics();
  }, [currentSong]);

  const handleClose = () => {
    setAnimationStage("exit");
    setTimeout(() => {
      navigate(-1);
    }, 150);
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
      
      // Enregistrer les paroles dans la base de données
      const { error: insertError } = await supabase
        .from('lyrics')
        .upsert({
          song_id: currentSong.id,
          content: lyricsContent,
        });

      if (insertError) {
        throw insertError;
      }

      // Rafraîchir les paroles
      setLyricsText(lyricsContent);
      try {
        const parsed = parseLrc(lyricsContent);
        setParsedLyrics(parsed);
      } catch (e) {
        console.log('Les paroles ne sont pas au format LRC');
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
            ) : lyricsText ? (
              <div className="w-full h-full flex items-start justify-center overflow-hidden">
                <div className="w-full h-full max-w-3xl overflow-y-auto rounded-md p-4 md:p-6 backdrop-blur-sm bg-black/20">
                  {parsedLyrics && parsedLyrics.lines && parsedLyrics.lines.length > 0 ? (
                    <LrcPlayer 
                      parsedLyrics={parsedLyrics} 
                      currentTime={currentTime}
                      className="h-full text-lg"
                    />
                  ) : (
                    <div className="whitespace-pre-line text-spotify-neutral text-base md:text-lg leading-relaxed">
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
