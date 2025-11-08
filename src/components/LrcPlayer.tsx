import React, { useEffect, useState, useRef } from 'react';
import { findCurrentLyricLine, LrcLine } from '@/utils/lrcParser';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  
  // States for loading bar
  const [firstLyricTime, setFirstLyricTime] = useState<number | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isWaitingForFirstLyric, setIsWaitingForFirstLyric] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string>("");

  // Determine the first lyric time and setup loading bar
  useEffect(() => {
    if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) return;
    
    const firstLine = parsedLyrics.lines.find(line => line.text && line.text.trim() !== '' && line.time > 0);
    
    if (firstLine) {
      setFirstLyricTime(firstLine.time);
      
      if (currentTime < firstLine.time) {
        setIsWaitingForFirstLyric(true);
      } else {
        setIsWaitingForFirstLyric(false);
        setLoadingProgress(100);
      }
    }
  }, [parsedLyrics, currentTime]);

  // Update loading progress and remaining time
  useEffect(() => {
    if (isWaitingForFirstLyric && firstLyricTime !== null && firstLyricTime > 0) {
      const progress = Math.min(100, (currentTime / firstLyricTime) * 100);
      setLoadingProgress(progress);
      
      const timeRemaining = Math.max(0, firstLyricTime - currentTime);
      const seconds = Math.floor(timeRemaining);
      
      setRemainingTime(`${seconds} seconde${seconds > 1 ? 's' : ''}`);
      
      if (currentTime >= firstLyricTime) {
        setIsWaitingForFirstLyric(false);
      }
    }
  }, [currentTime, firstLyricTime, isWaitingForFirstLyric]);

  // Update active line and handle scrolling
  useEffect(() => {
    if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) return;

    const adjustedTime = parsedLyrics.offset 
      ? currentTime + (parsedLyrics.offset / 1000) 
      : currentTime;
    
    const { current, next } = findCurrentLyricLine(
      parsedLyrics.lines,
      adjustedTime,
      0
    );
    
    if (current !== currentLineIndex) {
      setCurrentLineIndex(current);
      setNextLines(next);
      setUserScrolling(false); // Force auto-scroll on line change
    }
  }, [currentTime, parsedLyrics, currentLineIndex]);

  // Auto-scroll effect, separated for clarity
  useEffect(() => {
    if (currentLineIndex >= 0 && containerRef.current && !userScrolling) {
      setTimeout(() => {
        if (activeLineRef.current && containerRef.current) {
          const containerHeight = containerRef.current.clientHeight;
          const lineTop = activeLineRef.current.offsetTop;
          const lineHeight = activeLineRef.current.clientHeight;

          let scrollPosition;
          if (isMobile) {
            // On mobile, scroll to top 20%
            scrollPosition = lineTop - (containerHeight * 0.2);
          } else {
            // On desktop, scroll to center
            scrollPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
          }
          
          containerRef.current.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  }, [currentLineIndex, userScrolling, isMobile]);

  // Handle user manual scrolling
  const handleScroll = () => {
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    setUserScrolling(true);
    scrollTimeoutRef.current = window.setTimeout(() => {
      setUserScrolling(false);
    }, 3000); // Reduced timeout to 3 seconds
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const getColorLuminance = (color: [number, number, number]) => {
    const [r, g, b] = color.map(c => {
      const normalized = c / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const getAccentColor = () => {
    if (!accentColor) return 'rgb(255, 255, 255)';
    const luminance = getColorLuminance(accentColor);
    return luminance < 0.4 
      ? 'rgb(255, 255, 255)' 
      : `rgb(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]})`;
  };

  const activeLineStyle = {
    color: getAccentColor(),
    textShadow: accentColor && getColorLuminance(accentColor) >= 0.4
      ? `0 0 8px rgba(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}, 0.5)`
      : '0 0 8px rgba(255, 255, 255, 0.3)'
  };

  if (!parsedLyrics?.lines || parsedLyrics.lines.length === 0) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <p className="text-white/70">Pas de paroles synchronisées disponibles</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
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
      
      <div 
        className={`overflow-y-auto h-full relative ${className}`}
        ref={containerRef}
        onScroll={handleScroll}
      >
        <div className={isMobile ? "h-[20vh]" : "h-[50vh]"}></div>
        
        <div className="py-8">
          {parsedLyrics.lines.map((line, index) => (
            <div 
              key={`${index}-${line.time}`}
              data-line-index={index}
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
        
        <div className={isMobile ? "h-[80vh]" : "h-[50vh]"}></div>
      </div>
    </div>
  );
};