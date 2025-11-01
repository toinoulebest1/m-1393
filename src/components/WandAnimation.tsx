import { useMemo } from 'react';
import wandGif from '@/assets/wand-animation.gif';
import wandGif2 from '@/assets/wand-animation-2.gif';
import wandGif5 from '@/assets/wand-animation-5.gif';

interface WandAnimationProps {
  isActive: boolean;
}

export const WandAnimation = ({ isActive }: WandAnimationProps) => {
  const selectedWand = useMemo(() => {
    const wands = [wandGif2, wandGif, wandGif5];
    return wands[Math.floor(Math.random() * wands.length)];
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
      <img 
        src={selectedWand} 
        alt="Magic wand animation" 
        className="w-full h-full object-contain opacity-60"
      />
    </div>
  );
};
