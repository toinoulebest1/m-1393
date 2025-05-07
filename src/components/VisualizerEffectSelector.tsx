
import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";

export type VisualizerEffect = 'bars' | 'wave' | 'circles' | 'spectrum';

interface VisualizerEffectSelectorProps {
  currentEffect: VisualizerEffect;
  onEffectChange: (effect: VisualizerEffect) => void;
}

const effectLabels: Record<VisualizerEffect, string> = {
  'bars': 'Barres',
  'wave': 'Vague',
  'circles': 'Cercles',
  'spectrum': 'Spectre'
};

export const VisualizerEffectSelector: React.FC<VisualizerEffectSelectorProps> = ({
  currentEffect,
  onEffectChange
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className="absolute top-2 left-2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all z-10"
          aria-label="Sélectionner l'effet"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-spotify-dark border-white/10">
        {(Object.keys(effectLabels) as VisualizerEffect[]).map((effect) => (
          <DropdownMenuItem 
            key={effect}
            className={`${currentEffect === effect ? 'bg-white/10 text-spotify-accent' : 'text-white'} hover:bg-white/20`}
            onClick={() => {
              console.log("Effet sélectionné:", effect);
              onEffectChange(effect);
            }}
          >
            {effectLabels[effect]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
