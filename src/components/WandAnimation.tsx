import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface WandAnimationProps {
  isActive: boolean;
}

export const WandAnimation = ({ isActive }: WandAnimationProps) => {
  const [sparkles, setSparkles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    if (!isActive) {
      setSparkles([]);
      return;
    }

    const createSparkles = () => {
      const newSparkles = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: 50 + (Math.random() - 0.5) * 60,
        y: 20 + Math.random() * 60,
        size: 2 + Math.random() * 4,
        delay: i * 0.1,
      }));
      setSparkles(newSparkles);
    };

    createSparkles();
    const interval = setInterval(createSparkles, 2500);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <>
      <style>
        {`
          @keyframes wand-glow {
            0%, 100% {
              filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))
                      drop-shadow(0 0 15px rgba(255, 223, 0, 0.6))
                      drop-shadow(0 0 25px rgba(255, 200, 50, 0.4));
              opacity: 0.9;
            }
            50% {
              filter: drop-shadow(0 0 15px rgba(255, 255, 255, 1))
                      drop-shadow(0 0 30px rgba(255, 223, 0, 0.8))
                      drop-shadow(0 0 45px rgba(255, 200, 50, 0.6));
              opacity: 1;
            }
          }

          @keyframes sparkle {
            0% {
              transform: translate(0, 0) scale(0);
              opacity: 0;
            }
            20% {
              opacity: 1;
            }
            100% {
              transform: translate(var(--tx), var(--ty)) scale(1);
              opacity: 0;
            }
          }

          @keyframes wand-raise {
            0%, 100% {
              transform: translateY(0) rotate(-45deg);
            }
            50% {
              transform: translateY(-8px) rotate(-35deg);
            }
          }
        `}
      </style>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Baguette magique */}
        <div 
          className="absolute bottom-4 right-4 w-16 h-1.5 rounded-full origin-left"
          style={{
            background: 'linear-gradient(90deg, #8B4513 0%, #D2691E 70%, rgba(255, 255, 255, 0.9) 100%)',
            animation: 'wand-raise 2s ease-in-out infinite, wand-glow 1.5s ease-in-out infinite',
            transformOrigin: 'left center',
          }}
        >
          {/* Pointe lumineuse de la baguette */}
          <div 
            className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 223, 0, 0.8) 40%, transparent 70%)',
              boxShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(255, 223, 0, 0.6)',
            }}
          />
        </div>

        {/* Étincelles magiques */}
        {sparkles.map((sparkle) => (
          <div
            key={sparkle.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              width: `${sparkle.size}px`,
              height: `${sparkle.size}px`,
              '--tx': `${(Math.random() - 0.5) * 200}px`,
              '--ty': `${-50 - Math.random() * 100}px`,
              animation: `sparkle 2s ease-out ${sparkle.delay}s infinite`,
              boxShadow: '0 0 6px rgba(255, 255, 255, 0.8), 0 0 12px rgba(255, 223, 0, 0.6)',
            } as React.CSSProperties}
          />
        ))}

        {/* Lueurs magiques ambiantes */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 223, 0, 0.15) 0%, transparent 70%)',
            animation: 'wand-glow 3s ease-in-out infinite',
          }}
        />
      </div>
    </>
  );
};
