
import React, { useEffect, useState, useRef } from 'react';
import { findCurrentLyricLine, LrcLine } from '@/utils/lrcParser';
import { Progress } from '@/components/ui/progress';

interface LrcPlayerProps {
  parsedLyrics: { lines: LrcLine[], offset?: number } | null;
  currentTime: number;
  className?: string;
  accentColor?: [number, number, number] | null;
}

export const LrcPlayer: React.FC<LrcPlayerProps> = ({ 
  parsedLyrics, 
  currentTime, 
  className = "",
  accentColor = null
}) => {
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [nextLines, setNextLines] = useState<LrcLine[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number>(0);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  
  // States for loading bar
  const [firstLyricTime, setFirstLyricTime] = useState<number | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isWaitingForFirstLyric, setIsWaitingForFirstLyric] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string>("");
  const lastCurrentTimeRef = useRef<number>(0);

  // Log for debugging time synchronization
  useEffect(() => {
    if (Math.abs(currentTime - lastCurrentTimeRef.current) > 0.2) {
      console.log(`LrcPlayer: Temps mis à jour - ${currentTime.toFixed(2)}s (différence: ${(currentTime - lastCurrentTimeRef.current).toFixed(2)}s)`);
      lastCurrentTimeRef.current = currentTime;
    }
  }, [currentTime]);

  // Determine the first lyric time and setup loading bar
  useEffect(() => {
    if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) return;
    
    // Find the first non-empty lyric line with a time greater than 0
    const firstLine = parsedLyrics.lines.find(line => line.text && line.text.trim() !== '' && line.time > 0);
    
    if (firstLine) {
      setFirstLyricTime(firstLine.time);
      
      // Check if we're before the first lyric
      if (currentTime < firstLine.time) {
        setIsWaitingForFirstLyric(true);
        console.log(`LrcPlayer: En attente de la première parole à ${firstLine.time}s, temps actuel: ${currentTime}s`);
      } else {
        setIsWaitingForFirstLyric(false);
        setLoadingProgress(100);
        console.log(`LrcPlayer: Les paroles ont déjà commencé`);
      }
    }
  }, [parsedLyrics, currentTime]);

  // Update loading progress and remaining time based on current time
  useEffect(() => {
    if (isWaitingForFirstLyric && firstLyricTime !== null && firstLyricTime > 0) {
      // Calculate progress as a percentage of time until first lyric
      const progress = Math.min(100, (currentTime / firstLyricTime) * 100);
      setLoadingProgress(progress);
      
      if (progress % 5 < 0.2) {
        // Log moins fréquemment pour éviter la surcharge
        console.log(`LrcPlayer: Progression du chargement: ${progress.toFixed(1)}%, temps actuel: ${currentTime.toFixed(1)}s, premier lyric à: ${firstLyricTime.toFixed(1)}s`);
      }
      
      // Calculate remaining time in seconds
      const timeRemaining = Math.max(0, firstLyricTime - currentTime);
      const seconds = Math.floor(timeRemaining);
      
      // Format the remaining time
      setRemainingTime(`${seconds} seconde${seconds > 1 ? 's' : ''}`);
      
      // If we've reached the first lyric, stop showing the loading bar
      if (currentTime >= firstLyricTime) {
        console.log(`LrcPlayer: Première parole atteinte`);
        setIsWaitingForFirstLyric(false);
      }
    }
  }, [currentTime, firstLyricTime, isWaitingForFirstLyric]);

  // Update active line based on current playback time
  useEffect(() => {
    if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) return;

    // Apply offset if it exists
    const adjustedTime = parsedLyrics.offset 
      ? currentTime + (parsedLyrics.offset / 1000) 
      : currentTime;

    // Log moins fréquemment
    if (Math.abs(adjustedTime - previousTimeRef.current) > 0.5) {
      console.log(`LrcPlayer: Temps ajusté - ${adjustedTime.toFixed(2)}s (offset: ${parsedLyrics.offset || 0}ms)`);
      previousTimeRef.current = adjustedTime;
    }
    
    const { current, next } = findCurrentLyricLine(
      parsedLyrics.lines,
      adjustedTime,
      0 // Offset is already applied
    );
    
    if (current !== currentLineIndex) {
      console.log(`LrcPlayer: Nouvelle ligne active - Index ${current}, Temps ${parsedLyrics.lines[current]?.time.toFixed(2)}s`);
      setCurrentLineIndex(current);
      setNextLines(next);
      
      // Auto-scroll to active line if user is not manually scrolling
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

  // Handle user manual scrolling
  const handleScroll = () => {
    setUserScrolling(true);
    
    // Reset auto-scroll timeout
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    
    // Resume auto-scroll after 5 seconds of inactivity
    scrollTimeoutRef.current = window.setTimeout(() => {
      setUserScrolling(false);
    }, 5000);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Generate styles based on accentColor
  const getAccentColor = () => {
    if (!accentColor) return 'rgb(137, 90, 240)'; // Default Spotify accent color
    return `rgb(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]})`;
  };

  // Style for active line with accent color
  const activeLineStyle = accentColor ? {
    color: getAccentColor(),
    textShadow: `0 0 8px rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 0.5)`
  } : undefined;

  if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <p className="text-white/70">Pas de paroles synchronisées disponibles</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Loading progress bar before the first lyric */}
      {isWaitingForFirstLyric && firstLyricTime && (
        <div className="w-full px-4 py-2 mb-4 animate-fade-in">
          <div className="text-center text-white/70 mb-2">
            Début des paroles dans {remainingTime}
          </div>
          <Progress 
            value={loadingProgress} 
            className="h-2 bg-white/10" 
            indicatorClassName={accentColor ? 
              `bg-[rgb(${accentColor[0]},${accentColor[1]},${accentColor[2]})]` : 
              "bg-spotify-accent"
            }
          />
          <div className="flex justify-between text-xs text-white/50 mt-1">
            <span>0:00</span>
            <span>{Math.floor(firstLyricTime / 60)}:{String(Math.floor(firstLyricTime % 60)).padStart(2, '0')}</span>
          </div>
        </div>
      )}
      
      {/* Lyrics content */}
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
                  ? 'font-bold text-2xl' 
                  : nextLines.some(nextLine => nextLine.time === line.time)
                    ? 'text-white/90 text-xl'
                    : index < currentLineIndex 
                      ? 'text-white/30 text-lg'
                      : 'text-white/60 text-lg'
                }
              `}
              style={currentLineIndex === index ? activeLineStyle : undefined}
            >
              {line.text || " "}
            </div>
          ))}
        </div>
        
        {/* Spacer at bottom to allow centering of last lines */}
        <div className="h-[40vh]"></div>
      </div>
    </div>
  );
};
