
import React from "react";
import { Heart, MoreHorizontal, Mic, AlertTriangle, Music, Play, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerContext } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Song } from "@/types/player";
import { rgbToClass } from "@/utils/colorExtractor";
import { useNavigate, useLocation } from "react-router-dom";
import { AutoplayManager } from "@/utils/autoplayManager";
import { toast } from "@/hooks/use-toast";

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  show?: boolean;
}

interface SongCardProps {
  song: {
    id: string;
    title: string;
    artist?: string;
    duration?: string;
    imageUrl?: string;
    url?: string; // Make url optional in the component interface
  };
  isCurrentSong?: boolean;
  isFavorite?: boolean;
  onReportClick?: () => void;
  onLyricsClick?: () => void;
  dominantColor?: [number, number, number] | null;
  contextMenuItems?: ContextMenuItem[];
}

export const SongCard = ({
  song,
  isCurrentSong = false,
  isFavorite = false,
  onReportClick,
  onLyricsClick,
  dominantColor,
  contextMenuItems = [],
}: SongCardProps) => {
  const { toggleFavorite, isPlaying, pause, play } = usePlayerContext();
  const navigate = useNavigate();
  const location = useLocation();
  const handlePlay = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    
    // Enregistrer l'interaction utilisateur pour débloquer l'autoplay
    AutoplayManager.registerUserInteraction();
    
    if (isCurrentSong) {
      isPlaying ? pause() : play();
    } else {
      // Convert the songCard song format to the required Song format
      const fullSong: Song = {
        id: song.id,
        title: song.title,
        artist: song.artist || "",
        duration: song.duration || "0:00",
        url: song.url || "", // Provide a default empty string for url if not present
        imageUrl: song.imageUrl,
      };
      play(fullSong);
    }
  };

  const handleLyricsClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    
    // Check if the current song is playing
    if (!isCurrentSong || !isPlaying) {
      toast({
        title: "Lecture requise",
        description: "Veuillez démarrer la lecture de cette musique pour accéder aux paroles synchronisées",
        variant: "destructive",
      });
      return;
    }
    
    // Navigate to synced lyrics page instead of using modal
    sessionStorage.setItem(`scroll-${location.pathname}`, window.scrollY.toString());
    navigate("/synced-lyrics", { state: { from: location.pathname + location.search } });
    // If the onLyricsClick prop is provided, call it as well (for backward compatibility)
    if (onLyricsClick) {
      onLyricsClick();
    }
  };

  // Generate dynamic background style based on dominantColor if provided and song is current
  const bgStyle = isCurrentSong && dominantColor ? {
    background: `linear-gradient(to bottom right, rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2), rgba(0, 0, 0, 0.05))`,
    borderColor: `rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.3)`,
  } : {};

  // Get color class for gradient if available
  const colorClass = isCurrentSong && dominantColor ? rgbToClass(dominantColor) : '';

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer hover:bg-white/5 border border-transparent relative",
        isCurrentSong && "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10",
        isCurrentSong && isPlaying && "animate-subtle-pulse",
        isCurrentSong && colorClass ? "bg-gradient-to-br" : ""
      )}
      style={bgStyle}
      onClick={handlePlay}
    >
      {/* Indicateur de lecture en cours */}
      {isCurrentSong && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full animate-pulse" />
      )}
      <div className="w-12 h-12 flex-shrink-0 overflow-hidden rounded relative group">
        {song.imageUrl ? (
          <img
            src={song.imageUrl}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Music className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        
        {isCurrentSong && isPlaying && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center group-hover:hidden">
            <Play className="h-6 w-6 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2">
          <div className={cn(
            "text-base font-medium truncate",
            isCurrentSong && "text-primary"
          )}>{song.title}</div>
          {isCurrentSong && (
            <Radio className="h-3.5 w-3.5 text-primary flex-shrink-0 animate-pulse" />
          )}
        </div>
        <div className={cn(
          "text-xs",
          isCurrentSong ? "text-primary/70" : "text-muted-foreground"
        )} title={song.artist || "Artiste inconnu"}>
          {song.artist || "Artiste inconnu"}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {song.duration && (
          <div className="text-xs text-muted-foreground hidden sm:block">
            {song.duration}
          </div>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            // Create a properly formatted song object for toggleFavorite
            const fullSong: Song = {
              id: song.id,
              title: song.title,
              artist: song.artist || "",
              duration: song.duration || "0:00",
              url: song.url || "",
              imageUrl: song.imageUrl,
            };
            toggleFavorite(fullSong);
          }}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            isFavorite && "text-spotify-accent"
          )}
        >
          <Heart
            size={18}
            className={cn(
              "transition-all",
              isFavorite && "fill-spotify-accent text-spotify-accent"
            )}
          />
        </Button>

        {/* Lyrics button now navigates to synced lyrics page */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLyricsClick}
          disabled={!isCurrentSong || !isPlaying}
          className={cn(
            "text-muted-foreground hover:text-foreground transition-opacity",
            (!isCurrentSong || !isPlaying) && "opacity-40 cursor-not-allowed"
          )}
        >
          <Mic size={18} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {contextMenuItems
              .filter(item => item.show !== false)
              .map((item, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.action();
                  }}
                >
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.label}
                </DropdownMenuItem>
              ))}
              
            {contextMenuItems.some(item => item.show !== false) && 
             onReportClick && <div className="h-px bg-border my-1" />}
             
            {onReportClick && (
              <DropdownMenuItem
                className="text-red-500 dark:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onReportClick();
                }}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Signaler
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default SongCard;
