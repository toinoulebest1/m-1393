
import { useState, useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Clock, Signal, Heart, Flag, FileText, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkFileExistsOnOneDrive, isOneDriveEnabled } from "@/utils/oneDriveStorage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SongCardProps {
  song: any;
  isCurrentSong: boolean;
  isFavorite: boolean;
  dominantColor: [number, number, number] | null;
  onLyricsClick?: (song: any) => void;
  onReportClick?: (song: any) => void;
}

export function SongCard({
  song,
  isCurrentSong,
  isFavorite,
  dominantColor,
  onLyricsClick,
  onReportClick
}: SongCardProps) {
  const { toggleFavorite, play, pause, isPlaying, removeSong } = usePlayer();
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  
  // Vérifier la disponibilité du fichier audio au chargement du composant
  useEffect(() => {
    const checkAvailability = async () => {
      if (isOneDriveEnabled()) {
        try {
          const exists = await checkFileExistsOnOneDrive(`audio/${song.id}`);
          setIsAvailable(exists);
        } catch (error) {
          console.error("Erreur lors de la vérification de disponibilité:", error);
          setIsAvailable(null);
        }
      } else {
        setIsAvailable(true); // Supposer que le fichier est disponible si OneDrive n'est pas activé
      }
    };
    
    checkAvailability();
  }, [song.id]);
  
  const glowStyle = isCurrentSong && dominantColor ? {
    "--glow-shadow": `
    0 0 10px 5px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.3),
    0 0 20px 10px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.2),
    0 0 30px 15px rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.1)
    `,
  } as React.CSSProperties : {};

  const handlePlay = () => {
    if (isAvailable === false) {
      return; // Ne rien faire si le fichier n'est pas disponible
    }
    
    if (isCurrentSong) {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    }
  };
  
  const goToArtistProfile = (e: React.MouseEvent) => {
    e.stopPropagation(); // Empêche la propagation de l'événement (évite de déclencher handlePlay)
    
    if (song.deezerArtistId) {
      // Utilisation de window.location pour une navigation complète
      window.location.href = `${window.location.origin}/artist/${song.deezerArtistId}`;
    }
  };
  
  return (
    <div
      className={cn(
        "group flex items-center justify-between p-4 rounded-lg transition-all duration-500 cursor-pointer",
        isCurrentSong ? "bg-white/5 backdrop-blur-sm" : "hover:bg-white/5",
        "transform hover:scale-[1.02] hover:-translate-y-0.5 transition-transform duration-300",
        isAvailable === false && "opacity-75 border border-red-500/20"
      )}
      onClick={() => handlePlay()}
    >
      {isCurrentSong && (
        <div className="absolute inset-0 z-0 overflow-hidden rounded-lg">
          <div 
            className="absolute inset-0 animate-gradient opacity-20" 
            style={{
              backgroundSize: '200% 200%',
              animation: 'gradient 3s linear infinite',
              background: dominantColor 
                ? `linear-gradient(45deg, 
                  rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.8),
                  rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 0.4)
                )`
                : 'linear-gradient(45deg, #8B5CF6, #D946EF, #0EA5E9)',
            }}
          />
        </div>
      )}

      <div className="relative z-10 flex items-center justify-between w-full group">
        <div className="flex items-center flex-1">
          <div 
            className={cn(
              "relative overflow-hidden rounded-md transition-transform duration-300",
              isCurrentSong && "animate-pulse-glow"
            )}
            style={glowStyle}
          >
            <img
              src={song.imageUrl || "https://picsum.photos/56/56"}
              alt={song.title}
              className={cn(
                "w-14 h-14 object-cover rounded-md",
                isAvailable === false && "opacity-50"
              )}
            />
            {isAvailable === false && (
              <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                <span className="text-xs text-white font-medium">Non disponible</span>
              </div>
            )}
          </div>
          <div className="ml-4">
            <h3 className={cn(
              "font-medium transform transition-all duration-300",
              isCurrentSong ? "text-white scale-105" : "text-spotify-neutral group-hover:text-white group-hover:scale-105"
            )}>
              {song.title}
            </h3>
            {song.deezerArtistId ? (
              <div 
                className={cn(
                  "flex items-center text-sm transition-all duration-300 cursor-pointer hover:underline",
                  isCurrentSong ? "text-white/80" : "text-spotify-neutral group-hover:text-white/80"
                )}
                onClick={goToArtistProfile}
              >
                <Avatar 
                  className="h-5 w-5 mr-1.5 hover:scale-110 transition-transform duration-300 bg-spotify-accent/40"
                  onClick={goToArtistProfile}
                >
                  <AvatarImage src={`https://e-cdns-images.dzcdn.net/images/artist/${song.deezerArtistId}/500x500-000000-80-0-0.jpg`} />
                  <AvatarFallback>
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span>{song.artist}</span>
                <span className="ml-1.5 text-[10px] bg-spotify-accent/25 px-2 py-0.5 rounded-full flex items-center">
                  <User className="h-3 w-3 mr-0.5" />
                  Profil
                </span>
              </div>
            ) : (
              <p className={cn(
                "text-sm transition-all duration-300",
                isCurrentSong ? "text-white/80" : "text-spotify-neutral group-hover:text-white/80"
              )}>
                {song.artist}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className={cn(
            "flex items-center space-x-1",
            isCurrentSong ? "text-white/80" : "text-spotify-neutral group-hover:text-white/80"
          )}>
            <Clock className="w-4 h-4" />
            <span className="text-sm">{song.duration || "0:00"}</span>
          </div>

          <div className={cn(
            "flex items-center space-x-1",
            isCurrentSong ? "text-white/80" : "text-spotify-neutral group-hover:text-white/80"
          )}>
            <Signal className="w-4 h-4" />
            <span className="text-sm">{song.bitrate || "320 kbps"}</span>
          </div>

          <div className="flex items-center space-x-2">
            {isAvailable === false ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSong(song.id);
                }}
                className="p-2 hover:bg-red-500/20 rounded-full transition-all duration-300"
                title="Supprimer cette chanson"
              >
                <Trash2 className="w-5 h-5 text-red-400 hover:text-red-300 transition-all duration-300 hover:scale-110" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(song);
                }}
                className="p-2 hover:bg-white/5 rounded-full transition-all duration-300"
              >
                <Heart
                  className={cn(
                    "w-5 h-5 transition-all duration-300 hover:scale-110",
                    isFavorite
                      ? "text-red-500 fill-red-500"
                      : "text-spotify-neutral hover:text-white"
                  )}
                />
              </button>
            )}

            {onLyricsClick && isAvailable !== false && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLyricsClick(song);
                }}
                className="p-2 hover:bg-white/5 rounded-full transition-all duration-300"
              >
                <FileText className="w-5 h-5 text-spotify-neutral hover:text-white transition-all duration-300 hover:scale-110" />
              </button>
            )}

            {onReportClick && isAvailable !== false && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReportClick(song);
                }}
                className="p-2 hover:bg-white/5 rounded-full transition-all duration-300"
              >
                <Flag className="w-5 h-5 text-spotify-neutral hover:text-white transition-all duration-300 hover:scale-110" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
