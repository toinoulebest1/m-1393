import wandGif from '@/assets/wand-animation.gif';

interface WandAnimationProps {
  isActive: boolean;
}

export const WandAnimation = ({ isActive }: WandAnimationProps) => {
  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50 flex items-center justify-center">
      <img 
        src={wandGif} 
        alt="Magic wand animation" 
        className="w-full h-full object-contain"
      />
    </div>
  );
};
