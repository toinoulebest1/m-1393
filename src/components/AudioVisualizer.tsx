
import React, { useRef, useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';

interface AudioVisualizerProps {
  isVisible: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isPlaying } = usePlayer();
  
  useEffect(() => {
    if (!isVisible) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Configuration de l'analyseur audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    // Connexion à l'élément audio global
    const audioElement = document.querySelector('audio');
    if (!audioElement) return;
    
    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    
    const barWidth = (WIDTH / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    function renderFrame() {
      if (!isVisible) return;
      
      requestAnimationFrame(renderFrame);
      
      x = 0;
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        // Couleur dynamique basée sur la fréquence
        const h = i / bufferLength * 360;
        ctx.fillStyle = `hsla(${h}, 100%, 50%, 0.8)`;
        
        ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    }
    
    if (isPlaying) {
      renderFrame();
    }
    
    return () => {
      // Nettoyage
      try {
        source.disconnect();
        analyser.disconnect();
      } catch (error) {
        console.error("Erreur lors du nettoyage du visualiseur:", error);
      }
    };
  }, [isVisible, isPlaying]);
  
  if (!isVisible) return null;
  
  return (
    <div className="absolute bottom-24 left-0 right-0 flex justify-center z-40">
      <canvas 
        ref={canvasRef} 
        width={window.innerWidth * 0.8} 
        height={120}
        className="rounded-lg bg-black bg-opacity-30 backdrop-blur-sm"
      />
    </div>
  );
};
