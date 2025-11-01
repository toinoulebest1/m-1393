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
      const newSparkles = Array.from({ length: 20 }, (_, i) => ({
        id: Date.now() + i,
        x: 50 + (Math.random() - 0.5) * 100,
        y: 30 + Math.random() * 40,
        size: 3 + Math.random() * 6,
        delay: i * 0.08,
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
          @keyframes wand-main-glow {
            0%, 100% {
              filter: drop-shadow(0 0 20px rgba(255, 255, 255, 1))
                      drop-shadow(0 0 40px rgba(255, 223, 0, 0.8))
                      drop-shadow(0 0 60px rgba(255, 200, 50, 0.6));
            }
            50% {
              filter: drop-shadow(0 0 30px rgba(255, 255, 255, 1))
                      drop-shadow(0 0 60px rgba(255, 223, 0, 1))
                      drop-shadow(0 0 90px rgba(255, 200, 50, 0.8));
            }
          }

          @keyframes light-beam {
            0% {
              opacity: 0.3;
              transform: scaleY(0.5);
            }
            50% {
              opacity: 0.7;
              transform: scaleY(1);
            }
            100% {
              opacity: 0.3;
              transform: scaleY(0.5);
            }
          }

          @keyframes sparkle-float {
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

          @keyframes wand-lift {
            0%, 100% {
              transform: translateY(0) rotate(-75deg);
            }
            50% {
              transform: translateY(-15px) rotate(-70deg);
            }
          }

          @keyframes tip-pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.9;
            }
            50% {
              transform: scale(1.5);
              opacity: 1;
            }
          }
        `}
      </style>

      <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
        {/* Faisceau de lumière qui monte */}
        <div 
          className="absolute left-1/2 bottom-0 -translate-x-1/2 w-32 h-full origin-bottom"
          style={{
            background: 'linear-gradient(to top, rgba(255, 255, 255, 0.4) 0%, rgba(255, 223, 0, 0.3) 30%, transparent 100%)',
            animation: 'light-beam 3s ease-in-out infinite',
            clipPath: 'polygon(40% 100%, 45% 0%, 55% 0%, 60% 100%)',
          }}
        />

        {/* Baguette magique principale - plus grande et visible */}
        <div 
          className="absolute left-1/2 bottom-8 -translate-x-1/2 w-48 h-3 rounded-full origin-bottom"
          style={{
            background: 'linear-gradient(90deg, #4A2511 0%, #8B4513 30%, #D2691E 70%, rgba(139, 69, 19, 0.8) 100%)',
            animation: 'wand-lift 3s ease-in-out infinite, wand-main-glow 2s ease-in-out infinite',
            boxShadow: '0 0 10px rgba(139, 69, 19, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
          }}
        >
          {/* Pointe lumineuse de la baguette - très brillante */}
          <div 
            className="absolute -right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.9) 20%, rgba(255, 223, 0, 0.8) 50%, transparent 100%)',
              boxShadow: `
                0 0 20px rgba(255, 255, 255, 1),
                0 0 40px rgba(255, 223, 0, 0.8),
                0 0 60px rgba(255, 200, 50, 0.6),
                0 0 80px rgba(255, 200, 50, 0.4)
              `,
              animation: 'tip-pulse 2s ease-in-out infinite',
            }}
          />
          
          {/* Halo lumineux autour de la pointe */}
          <div 
            className="absolute -right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 223, 0, 0.2) 40%, transparent 70%)',
              animation: 'tip-pulse 2s ease-in-out infinite 0.3s',
            }}
          />
        </div>

        {/* Étincelles magiques - plus nombreuses */}
        {sparkles.map((sparkle) => (
          <div
            key={sparkle.id}
            className="absolute rounded-full"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              width: `${sparkle.size}px`,
              height: `${sparkle.size}px`,
              background: 'radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 223, 0, 0.8) 50%, transparent 100%)',
              '--tx': `${(Math.random() - 0.5) * 300}px`,
              '--ty': `${-100 - Math.random() * 150}px`,
              animation: `sparkle-float 2.5s ease-out ${sparkle.delay}s infinite`,
              boxShadow: '0 0 8px rgba(255, 255, 255, 0.9), 0 0 16px rgba(255, 223, 0, 0.7)',
            } as React.CSSProperties}
          />
        ))}

        {/* Lueurs ambiantes dorées */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 223, 0, 0.2) 0%, transparent 70%)',
            animation: 'wand-main-glow 4s ease-in-out infinite',
          }}
        />
      </div>
    </>
  );
};
