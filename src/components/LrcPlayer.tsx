
import React, { useEffect, useState } from 'react';
import { Lrc, LyricLine } from 'react-lrc';

interface LrcPlayerProps {
  lrcContent: string;
  currentTime: number;
  className?: string;
}

export const LrcPlayer: React.FC<LrcPlayerProps> = ({ 
  lrcContent, 
  currentTime, 
  className = ""
}) => {
  const [lineIndex, setLineIndex] = useState<number>(0);

  return (
    <div className={`overflow-y-auto h-full ${className}`}>
      <Lrc
        lrc={lrcContent}
        // currentTime is passed as a custom prop and handled internally by the component
        lineRenderer={({ index, active, line }) => (
          <div
            key={index}
            className={`py-2 px-4 transition-all duration-300 text-lg ${
              active 
                ? 'text-spotify-accent font-bold scale-110' 
                : 'text-white/70'
            }`}
          >
            {line.content}
          </div>
        )}
        currentMillisecond={currentTime * 1000} // Convert seconds to milliseconds
        onLineChange={(line) => setLineIndex(line.index)} // Fix the type mismatch
      />
    </div>
  );
};
