
import React from 'react';
import { ExternalLink } from 'lucide-react';

export const AdBanner = () => {
  return (
    <div className="p-4 bg-spotify-accent/10 rounded-lg mx-2">
      <a 
        href="https://www.spotify.com/premium" 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex flex-col items-center text-center space-y-2 hover:text-spotify-accent transition-colors"
      >
        <div className="font-semibold">Passez à Premium</div>
        <div className="text-sm text-spotify-neutral">
          Profitez de la musique sans publicités
        </div>
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
};
