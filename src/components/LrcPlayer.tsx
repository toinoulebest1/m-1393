
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

  // Mise à jour de la ligne active en fonction du temps de lecture
  useEffect(() => {
    if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) return;

    const { current, next } = findCurrentLyricLine(
      parsedLyrics.lines,
      currentTime,
      parsedLyrics.offset || 0
    );
    
    if (current !== currentLineIndex) {
      setCurrentLineIndex(current);
      setNextLines(next);
      
      // Auto-scroll vers la ligne active si l'utilisateur ne fait pas défiler manuellement
      if (current >= 0 && containerRef.current && !userScrolling) {
        const lineElement = containerRef.current.querySelector(`[data-line-index="${current}"]`);
        if (lineElement) {
          lineElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
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
      className={`overflow-y-auto h-full ${className}`}
      ref={containerRef}
      onScroll={handleScroll}
    >
      <div className="py-8">
        {parsedLyrics.lines.map((line, index) => (
          <div 
            key={`${index}-${line.time}`}
            data-line-index={index}
            data-time={line.time}
            className={`
              py-2 px-4 transition-all duration-300 text-lg
              ${currentLineIndex === index 
                ? 'text-spotify-accent font-bold scale-110' 
                : nextLines.some(nextLine => nextLine.time === line.time)
                  ? 'text-white/90'
                  : index < currentLineIndex 
                    ? 'text-white/40'
                    : 'text-white/70'
              }
            `}
          >
            {line.text || " "}
          </div>
        ))}
      </div>
    </div>
  );
};
