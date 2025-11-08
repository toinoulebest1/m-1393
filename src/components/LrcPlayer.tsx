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
      } else {
        setIsWaitingForFirstLyric(false);
        setLoadingProgress(100);
      }
    }
  }, [parsedLyrics, currentTime]);

  // Update loading progress and remaining time based on current time
  useEffect(() => {
    if (isWaitingForFirstLyric && firstLyricTime !== null && firstLyricTime > 0) {
      // Calculate progress as a percentage of time until first lyric
      const progress = Math.min(100, (currentTime / firstLyricTime) * 100);
      setLoadingProgress(progress);
      
      // Calculate remaining time in seconds
      const timeRemaining = Math.max(0, firstLyricTime - currentTime);
      const seconds = Math.floor(timeRemaining);
      
      // Format the remaining time
      setRemainingTime(`${seconds} seconde${seconds > 1 ? 's' : ''}`);
      
      // If we've reached the first lyric, stop showing the loading bar
      if (currentTime >= firstLyricTime) {
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
    
    const { current, next } = findCurrentLyricLine(
      parsedLyrics.lines,
      adjustedTime,
      0 // Offset is already applied
    );
    
    if (current !== currentLineIndex) {
      setCurrentLineIndex(current);
      setNextLines(next);
      
      // Auto-scroll to active line if user is not manually scrolling
      if (current >= 0 && containerRef.current && !userScrolling) {
        setTimeout(() => {
          if (activeLineRef.current && containerRef.current) {
            // Scroll the active line to the top of the container, not the center
            const containerHeight = containerRef.current.clientHeight;
            const lineTop = activeLineRef.current.offsetTop;
            
            // Calculate position to scroll the line to the top 20% of the view
            const scrollPosition = lineTop - (containerHeight * 0.2);
            
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

  // Calculate luminance to determine if a color is dark or light
  const getColorLuminance = (color: [number, number, number]) => {
    const [r, g, b] = color.map(c => {
      const normalized = c / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Generate styles based on accentColor with proper contrast
  const getAccentColor = () => {
    if (!accentColor) return 'rgb(255, 255, 255)'; // Default white
    const luminance = getColorLuminance(accentColor);
    // If color is too dark (luminance < 0.4), use white for better contrast
    return luminance < 0.4 
      ? 'rgb(255, 255, 255)' 
      : `rgb(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]})`;
  };

  // Style for active line with accent color
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