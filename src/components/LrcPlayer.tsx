
import React, { useEffect, useState, useRef } from 'react';
import { findCurrentLyricLine, LrcLine } from '@/utils/lrcParser';

interface LrcPlayerProps {
  parsedLyrics: { lines: LrcLine[], offset?: number } | null;
  currentTime: number;
  className?: string;
}

export const LrcPlayer: React.FC<LrcPlayerProps> = ({ 
  parsedLyrics, 
  currentTime, 
  className = ""
}) => {
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [nextLines, setNextLines] = useState<LrcLine[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number>(0);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Ajout de logs pour diagnostiquer la synchronisation
  useEffect(() => {
    if (currentTime !== previousTimeRef.current) {
      console.log(`LrcPlayer: Temps mis à jour - ${currentTime.toFixed(2)}s`);
      previousTimeRef.current = currentTime;
    }
  }, [currentTime]);

  // Mise à jour de la ligne active en fonction du temps de lecture avec plus de précision
  useEffect(() => {
    if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) return;

    // Appliquer l'offset s'il existe
    const adjustedTime = parsedLyrics.offset 
      ? currentTime + (parsedLyrics.offset / 1000) 
      : currentTime;

    console.log(`LrcPlayer: Temps ajusté - ${adjustedTime.toFixed(2)}s (offset: ${parsedLyrics.offset || 0}ms)`);
    
    const { current, next } = findCurrentLyricLine(
      parsedLyrics.lines,
      adjustedTime,
      0 // L'offset est déjà appliqué
    );
    
    if (current !== currentLineIndex) {
      console.log(`LrcPlayer: Nouvelle ligne active - Index ${current}, Temps ${parsedLyrics.lines[current]?.time.toFixed(2)}s`);
      setCurrentLineIndex(current);
      setNextLines(next);
      
      // Auto-scroll vers la ligne active si l'utilisateur ne fait pas défiler manuellement
      if (current >= 0 && containerRef.current && !userScrolling) {
        setTimeout(() => {
          if (activeLineRef.current && containerRef.current) {
            // Scroll the active line to the center of the container
            const containerHeight = containerRef.current.clientHeight;
            const lineTop = activeLineRef.current.offsetTop;
            const lineHeight = activeLineRef.current.clientHeight;
            
            // Calculate position to center the line
            const scrollPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
            
            containerRef.current.scrollTo({
              top: scrollPosition,
              behavior: 'smooth'
            });
          }
        }, 50); // Small delay to ensure the DOM is updated
      }
    }
  }, [currentTime, parsedLyrics, currentLineIndex, userScrolling]);

  // Gestion du défilement manuel de l'utilisateur
  const handleScroll = () => {
    setUserScrolling(true);
    
    // Réinitialiser le délai de scroll automatique
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    
    // Reprendre le défilement automatique après 5 secondes d'inactivité
    scrollTimeoutRef.current = window.setTimeout(() => {
      setUserScrolling(false);
    }, 5000);
  };

  // Nettoyage du timeout
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <p className="text-white/70">Pas de paroles synchronisées disponibles</p>
      </div>
    );
  }

  return (
    <div 
      className={`overflow-y-auto h-full relative ${className}`}
      ref={containerRef}
      onScroll={handleScroll}
    >
      {/* Spacer at top to allow centering of first lines */}
      <div className="h-[40vh]"></div>
      
      <div className="py-8">
        {parsedLyrics.lines.map((line, index) => (
          <div 
            key={`${index}-${line.time}`}
            data-line-index={index}
            data-time={line.time}
            ref={currentLineIndex === index ? activeLineRef : null}
            className={`
              py-2 px-4 transition-all duration-300 text-center my-3
              ${currentLineIndex === index 
                ? 'text-spotify-accent font-bold text-2xl' 
                : nextLines.some(nextLine => nextLine.time === line.time)
                  ? 'text-white/90 text-xl'
                  : index < currentLineIndex 
                    ? 'text-white/30 text-lg'
                    : 'text-white/60 text-lg'
              }
            `}
          >
            {line.text || " "}
          </div>
        ))}
      </div>
      
      {/* Spacer at bottom to allow centering of last lines */}
      <div className="h-[40vh]"></div>
    </div>
  );
};
