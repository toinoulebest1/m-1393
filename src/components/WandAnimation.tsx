import { useState, useEffect } from 'react';
import wandGif from '@/assets/wand-animation.gif';
import wandGif2 from '@/assets/wand-animation-2.gif';
import wandGif5 from '@/assets/wand-animation-5.gif';

interface WandAnimationProps {
  isActive: boolean;
}

export const WandAnimation = ({ isActive }: WandAnimationProps) => {
  const [currentWandIndex, setCurrentWandIndex] = useState(0);
  const wands = [wandGif2, wandGif, wandGif5];

  useEffect(() => {
    if (!isActive) {
      setCurrentWandIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentWandIndex((prev) => (prev + 1) % wands.length);
    }, 3000); // Change toutes les 3 secondes

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[-1] flex items-center justify-center">
      <img 
        src={wands[currentWandIndex]} 
        alt="Magic wand animation" 
        className="w-full h-full object-contain opacity-50 animate-fade-in"
      />
    </div>
  );
};
