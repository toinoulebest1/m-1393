
import React from 'react';
import { ExternalLink, Music, DollarSign, Crown } from 'lucide-react';

export const AdBanner = () => {
  return (
    <div className="p-4 bg-gradient-to-r from-black to-[#FF9900] rounded-lg mx-2 text-white shadow-lg hover:scale-102 transition-all duration-300">
      <a 
        href="https://www.amazon.fr/music/unlimited?tag=spotifyclone-21" 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex flex-col items-center text-center space-y-3"
      >
        <div className="font-bold text-lg">Amazon Music Unlimited</div>
        
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2 text-sm">
            <Music className="w-4 h-4" />
            <span>90 millions de titres en HD</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Crown className="w-4 h-4" />
            <span>Audio Spatial & Dolby Atmos</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4" />
            <span>Offre spéciale étudiants</span>
          </div>
        </div>

        <div className="bg-[#FF9900] text-black font-semibold px-4 py-2 rounded-full mt-2 flex items-center gap-2">
          30 jours gratuits
          <ExternalLink className="w-4 h-4" />
        </div>

        <div className="text-xs opacity-75 mt-1">
          *Puis 9,99€/mois sans engagement
        </div>
      </a>
    </div>
  );
};
