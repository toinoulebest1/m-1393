import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden" style={{ zIndex: 1 }}>
      <img 
        src={wands[currentWandIndex]} 
        alt="" 
        aria-hidden="true"
        className="w-full h-full object-contain opacity-30 animate-fade-in"
      />
    </div>,
    document.body
  );
};
