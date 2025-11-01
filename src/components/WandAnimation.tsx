import wandGif from '@/assets/wand-animation.gif';
import wandGif2 from '@/assets/wand-animation-2.gif';
import wandGif5 from '@/assets/wand-animation-5.gif';

interface WandAnimationProps {
  isActive: boolean;
}

export const WandAnimation = ({ isActive }: WandAnimationProps) => {
  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <img 
        src={wandGif2} 
        alt="Magic wand animation 1" 
        className="absolute left-0 top-0 w-1/3 h-full object-contain opacity-60"
      />
      <img 
        src={wandGif} 
        alt="Magic wand animation 2" 
        className="absolute left-1/3 top-0 w-1/3 h-full object-contain opacity-60"
      />
      <img 
        src={wandGif5} 
        alt="Magic wand animation 3" 
        className="absolute left-2/3 top-0 w-1/3 h-full object-contain opacity-60"
      />
    </div>
  );
};
