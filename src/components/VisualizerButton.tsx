
import React from 'react';
import { AudioWaveform } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VisualizerButtonProps {
  isActive: boolean;
  onClick: () => void;
}

export const VisualizerButton: React.FC<VisualizerButtonProps> = ({ 
  isActive, 
  onClick 
}) => {
  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-2 bg-gradient-to-r transition-all duration-300",
        isActive 
          ? "from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600 shadow-md shadow-purple-500/20" 
          : "from-white/5 to-white/10 hover:from-white/10 hover:to-white/20 border border-white/10"
      )}
    >
      <AudioWaveform className={cn("w-4 h-4", isActive && "animate-pulse")} />
      <span className="text-xs font-medium">
        {isActive ? 'Désactiver' : 'Visualiseur'}
      </span>
      {isActive && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-spotify-accent rounded-full animate-pulse"></span>
      )}
    </Button>
  );
};
