
import { Song } from "@/types/player";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";

interface UnavailableSongCardProps {
  song: Song;
}

export function UnavailableSongCard({ song }: UnavailableSongCardProps) {
  const { removeSong } = usePlayer();

  const handleRemove = () => {
    removeSong(song.id);
  };

  return (
    <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-2">
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src={song.imageUrl || "https://picsum.photos/56/56"}
            alt={song.title}
            className="w-12 h-12 rounded-md opacity-50"
          />
          <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
            <span className="text-xs text-white font-medium">Non disponible</span>
          </div>
        </div>
        <div>
          <h3 className="font-medium text-sm text-red-50">{song.title}</h3>
          <p className="text-xs text-red-200/70">{song.artist}</p>
        </div>
      </div>
      <Button 
        variant="ghost" 
        size="icon"
        className="text-red-200 hover:text-white hover:bg-red-800/50"
        onClick={handleRemove}
        title="Supprimer cette chanson"
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  );
}
