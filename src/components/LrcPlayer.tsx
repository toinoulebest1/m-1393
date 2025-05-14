
import React, { useEffect, useState } from 'react';
import Lrc from 'react-lrc';

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
        currentTime={currentTime}
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
        onLineChange={(index) => setLineIndex(index)}
      />
    </div>
  );
};
