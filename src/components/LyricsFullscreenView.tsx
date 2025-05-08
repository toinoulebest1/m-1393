import React, { useState, useEffect } from "react";
import { X, Music, Loader2, Maximize, Minimize, Play, Pause, SkipBack, SkipForward, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatTime(time: number): string {
  if (isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const LyricsFullscreenView = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [animationStage, setAnimationStage] = useState<"idle" | "content">("idle");
  const [contentAnimationVisible, setContentAnimationVisible] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { 
    currentSong: song, 
    isPlaying, 
    play, 
    pause, 
    progress,
    setProgress, 
    nextSong, 
    previousSong,
    favorites,
    toggleFavorite
  } = usePlayer();
  
  const isFavorite = favorites.some(f => f.id === song?.id);

  const { data: lyricsData, isLoading } = useQuery(
    ["lyrics", song?.artist, song?.title],
    async () => {
      if (!song?.artist || !song?.title) {
        return null;
      }

      const apiKey = process.env.NEXT_PUBLIC_MUSIXMATCH_API_KEY;
      const corsProxyUrl = 'https://corsproxy.io/?';
      const musixmatchApiUrl = `${corsProxyUrl}http://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_artist=${encodeURIComponent(song.artist)}&q_track=${encodeURIComponent(song.title)}&apikey=${apiKey}`;

      const response = await fetch(musixmatchApiUrl);
      const data = await response.json();

      if (data.message.body.lyrics) {
        return data.message.body.lyrics.lyrics_body;
      } else {
        setError("Paroles non trouvées.");
        return null;
      }
    },
    {
      enabled: !!song?.artist && !!song?.title,
      retry: false,
      onSuccess: (data) => {
        setLyrics(data || null);
        setError(null);
      },
      onError: () => {
        setError("Erreur lors de la récupération des paroles.");
        setLyrics(null);
      },
    }
  );

  useEffect(() => {
    setSongTitle(song?.title || "");
    setSongArtist(song?.artist || "");
  }, [song?.title, song?.artist]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setAnimationStage("content");
      setTimeout(() => setContentAnimationVisible(true), 50);
    } else {
      setContentAnimationVisible(false);
      setAnimationStage("idle");
    }
  }, [isOpen]);

  const openView = () => {
    setIsOpen(true);
  };

  const closeView = () => {
    setContentAnimationVisible(false);
    setTimeout(() => {
      setIsOpen(false);
    }, 500);
  };

  const generateLyrics = async () => {
    setIsGenerating(true);
    setError(null);

    if (!song?.artist || !song?.title) {
      setError("Impossible de récupérer les paroles sans artiste et titre.");
      setIsGenerating(false);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_MUSIXMATCH_API_KEY;
    const corsProxyUrl = 'https://corsproxy.io/?';
    const musixmatchApiUrl = `${corsProxyUrl}http://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_artist=${encodeURIComponent(song.artist)}&q_track=${encodeURIComponent(song.title)}&apikey=${apiKey}`;

    try {
      const response = await fetch(musixmatchApiUrl);
      const data = await response.json();

      if (data.message.body.lyrics) {
        setLyrics(data.message.body.lyrics.lyrics_body);
        setError(null);
      } else {
        setError("Paroles non trouvées.");
        setLyrics(null);
      }
    } catch (e) {
      setError("Erreur lors de la récupération des paroles.");
      setLyrics(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!song) return;
    
    await toggleFavorite(song);
    
    toast.success(
      <div className="flex items-center space-x-2">
        <Heart className={cn(
          "w-4 h-4",
          isFavorite ? "text-spotify-neutral" : "text-red-500 fill-red-500"
        )} />
        <span>{isFavorite ? 'Retiré des' : 'Ajouté aux'} favoris</span>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/90 backdrop-blur-lg transition-all duration-500 ease-in-out",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={closeView}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-spotify-neutral hover:text-white z-50"
        onClick={closeView}
      >
        <X className="h-6 w-6" />
      </Button>
      
      <div className="flex flex-col md:flex-row h-full py-16 md:py-20 md:px-12 lg:px-24" onClick={(e) => e.stopPropagation()}>
        {/* Left side - Song info and image */}
        <div className="flex-none md:w-1/2 lg:w-1/3 flex flex-col items-center md:items-start px-4 md:px-0">
          <div
            className={cn(
              "relative w-64 h-64 md:w-80 md:h-80 rounded-xl shadow-xl overflow-hidden mb-6 transition-all duration-500",
              animationStage === "content" && contentAnimationVisible
                ? "opacity-100 transform translate-y-0"
                : "opacity-0 transform translate-y-4"
            )}
            style={{
              transitionDelay: animationStage === "content" ? "100ms" : "0ms"
            }}
          >
            <img
              src={song?.imageUrl || "https://picsum.photos/640/640"}
              alt="Cover"
              className="object-cover w-full h-full"
            />
          </div>
          
          {/* Nouvelle barre de lecture juste après l'image et avant le titre */}
          <div className={cn(
            "w-full mb-4 transition-all duration-500",
            animationStage === "content" && contentAnimationVisible
              ? "opacity-100 transform translate-y-0" 
              : "opacity-0 transform translate-y-4"
          )}
          style={{
            transitionDelay: animationStage === "content" ? "150ms" : "0ms"
          }}>
            {/* Affichage de la progression */}
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-spotify-neutral">
                {formatTime(song?.duration ? (progress / 100) * parseInt(song.duration.split(':')[0]) * 60 + parseInt(song.duration.split(':')[1]) : 0)}
              </span>
              <span className="text-spotify-neutral">
                {song?.duration || "0:00"}
              </span>
            </div>
            
            {/* Barre de progression */}
            <div className="flex items-center space-x-4">
              <div className="flex-grow">
                <Progress 
                  value={progress} 
                  className="h-2"
                  onClick={(e) => {
                    const progressBarRect = e.currentTarget.getBoundingClientRect();
                    const clickPosition = e.clientX - progressBarRect.left;
                    const progressBarWidth = progressBarRect.width;
                    const newProgress = (clickPosition / progressBarWidth) * 100;
                    setProgress(newProgress);
                  }}
                />
              </div>
              
              {/* Boutons de contrôle à droite de la barre */}
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-spotify-neutral hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    previousSong();
                  }}
                >
                  <SkipBack className="h-5 w-5" />
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 rounded-full bg-white text-black hover:bg-white/80 hover:text-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    isPlaying ? pause() : play();
                  }}
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-spotify-neutral hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextSong();
                  }}
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
                
                {/* Nouveau bouton favoris */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-spotify-neutral hover:text-white group"
                  onClick={handleToggleFavorite}
                >
                  <Heart 
                    className={cn(
                      "h-5 w-5 transition-all duration-300 group-hover:scale-110",
                      isFavorite 
                        ? "text-red-500 fill-red-500" 
                        : "text-spotify-neutral hover:text-white"
                    )} 
                  />
                </Button>
              </div>
            </div>
          </div>
          
          <div className={cn(
            "text-center md:text-left transition-all duration-500 w-full px-4 md:px-0",
            animationStage === "content" && contentAnimationVisible
              ? "opacity-100 transform translate-y-0" 
              : "opacity-0 transform translate-y-4"
          )}
          style={{
            transitionDelay: animationStage === "content" ? "200ms" : "0ms"
          }}
          >
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

        {/* Right side - Lyrics content */}
        <div className="flex-1 md:w-1/2 lg:w-2/3 px-4 md:px-0">
          <div
            className={cn(
              "transition-all duration-500 h-full",
              animationStage === "content" && contentAnimationVisible
                ? "opacity-100 transform translate-y-0"
                : "opacity-0 transform translate-y-4"
            )}
            style={{
              transitionDelay: animationStage === "content" ? "300ms" : "0ms"
            }}
          >
            {/* Lyrics Display */}
            {lyrics ? (
              <ScrollArea className="h-full">
                <p className="text-white text-lg leading-relaxed whitespace-pre-line break-words">
                  {lyrics}
                </p>
              </ScrollArea>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-spotify-neutral" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-spotify-neutral">{error}</p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-spotify-neutral">
                  Pas de paroles disponibles.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
