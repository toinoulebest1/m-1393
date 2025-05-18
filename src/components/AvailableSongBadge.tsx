
import React from 'react';
import { Song } from '@/types/player';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Play } from 'lucide-react';

interface AvailableSongBadgeProps {
  song: Song | null;
  title: string;
  artist: string;
  className?: string;
  showPlayIcon?: boolean;
}

const AvailableSongBadge = ({ 
  song, 
  title, 
  artist, 
  className,
  showPlayIcon = true
}: AvailableSongBadgeProps) => {
  const { play, addToQueue } = usePlayer();
  
  if (!song) {
    return null;
  }
  
  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    play(song);
    toast.success(`Lecture de ${song.title}`);
  };
  
  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(song);
    toast.success(`${song.title} ajouté à la file d'attente`);
  };
  
  return (
    <button
      onClick={handlePlay}
      className={cn(
        "text-xs bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] text-white px-3 py-1 rounded-full hover:from-[#9B87F5] hover:to-[#F97316] transition-colors duration-300 font-medium transform hover:scale-105 flex items-center gap-1",
        className
      )}
      title={`Lire ${title} par ${artist}`}
    >
      {showPlayIcon && <Play className="w-3 h-3" />}
      Disponible Ici
    </button>
  );
};

export default AvailableSongBadge;
