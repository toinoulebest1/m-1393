
import React from 'react';
import { ExternalLink, Music, Wifi, Ban } from 'lucide-react';

export const AdBanner = () => {
  return (
    <div className="p-4 bg-gradient-to-r from-spotify-accent to-purple-600 rounded-lg mx-2 text-white shadow-lg hover:scale-102 transition-all duration-300">
      <a 
        href="https://www.spotify.com/premium" 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex flex-col items-center text-center space-y-3"
      >
        <div className="font-bold text-lg">Spotify Premium</div>
        
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2 text-sm">
            <Music className="w-4 h-4" />
            <span>Musique Haute Qualité</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Wifi className="w-4 h-4" />
            <span>Mode Hors-ligne</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Ban className="w-4 h-4" />
            <span>Sans publicités</span>
          </div>
        </div>

        <div className="bg-white text-spotify-accent font-semibold px-4 py-2 rounded-full mt-2 flex items-center gap-2">
          3 mois gratuits
          <ExternalLink className="w-4 h-4" />
        </div>

        <div className="text-xs opacity-75 mt-1">
          *Offre Premium individuelle uniquement
        </div>
      </a>
    </div>
  );
};
