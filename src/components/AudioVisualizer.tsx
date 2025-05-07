
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
    
    function renderFrame() {
      if (!isVisible) return;
      
      requestAnimationFrame(renderFrame);
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      
      // Fond avec dégradé
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, 'rgba(26, 31, 44, 0.3)');
      gradient.addColorStop(1, 'rgba(20, 24, 36, 0.3)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      const barWidth = (WIDTH / bufferLength) * 2;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * HEIGHT * 0.8;
        
        // Couleur dynamique basée sur la fréquence et l'amplitude
        const h = (i / bufferLength) * 300 + 240; // Teinte de couleur (bleu-violet)
        const s = 90; // Saturation
        const l = 50 + (dataArray[i] / 255) * 30; // Luminosité
        
        ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, 0.8)`;
        
        // Dessine une barre arrondie
        const roundedBarHeight = Math.max(4, barHeight);
        
        // Effet miroir pour les barres
        // Barre du haut
        ctx.beginPath();
        ctx.roundRect(x, HEIGHT/2 - roundedBarHeight, barWidth - 1, roundedBarHeight, 3);
        ctx.fill();
        
        // Barre du bas (effet miroir)
        ctx.beginPath();
        ctx.roundRect(x, HEIGHT/2, barWidth - 1, roundedBarHeight * 0.7, 3);
        ctx.fill();
        
        x += barWidth;
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
    <div className="fixed inset-x-0 bottom-24 flex justify-center z-40 px-4">
      <div className="w-full max-w-4xl">
        <canvas 
          ref={canvasRef} 
          width={800}
          height={180}
          className="w-full rounded-xl bg-black bg-opacity-25 backdrop-blur-md border border-white/10 shadow-lg"
        />
      </div>
    </div>
  );
};
