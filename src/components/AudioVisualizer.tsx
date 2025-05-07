
import React, { useRef, useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';

interface AudioVisualizerProps {
  isVisible: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isPlaying } = usePlayer();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Clean up on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          if (sourceRef.current) sourceRef.current.disconnect();
          if (analyserRef.current) analyserRef.current.disconnect();
          audioContextRef.current.close();
        } catch (error) {
          console.error("Error closing audio context:", error);
        }
      }
    };
  }, []);
  
  useEffect(() => {
    if (!isVisible) {
      // Clean up when visualizer is hidden
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Find audio element
    const audioElement = document.querySelector('audio');
    if (!audioElement) {
      console.error("No audio element found");
      return;
    }
    
    // Initialize audio context if needed
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Set up analyser
    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
    }
    
    // Connect to audio element if not already connected
    if (!sourceRef.current) {
      try {
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
        console.log("Successfully connected to audio source");
      } catch (error) {
        console.error("Error connecting to audio source:", error);
        // If we're already connected, we'll get an error. This is fine.
      }
    }
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    
    function renderFrame() {
      if (!isVisible) return;
      
      animationRef.current = requestAnimationFrame(renderFrame);
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, 'rgba(26, 31, 44, 0.3)');
      gradient.addColorStop(1, 'rgba(20, 24, 36, 0.3)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      const barWidth = (WIDTH / bufferLength) * 2;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * HEIGHT * 0.8;
        
        // Dynamic color based on frequency and amplitude
        const h = (i / bufferLength) * 300 + 240; // Color hue (blue-purple)
        const s = 90; // Saturation
        const l = 50 + (dataArray[i] / 255) * 30; // Brightness
        
        ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, 0.8)`;
        
        // Draw a rounded bar
        const roundedBarHeight = Math.max(4, barHeight);
        
        // Mirror effect for bars
        // Top bar
        ctx.beginPath();
        ctx.roundRect(x, HEIGHT/2 - roundedBarHeight, barWidth - 1, roundedBarHeight, 3);
        ctx.fill();
        
        // Bottom bar (mirror effect)
        ctx.beginPath();
        ctx.roundRect(x, HEIGHT/2, barWidth - 1, roundedBarHeight * 0.7, 3);
        ctx.fill();
        
        x += barWidth;
      }
    }
    
    // Start animation only if playing
    if (isPlaying) {
      renderFrame();
    }
    
  }, [isVisible, isPlaying]);
  
  // Update rendering when playback state changes
  useEffect(() => {
    if (isVisible && isPlaying && analyserRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;
      
      function renderFrame() {
        if (!isVisible || !isPlaying) return;
        
        animationRef.current = requestAnimationFrame(renderFrame);
        
        analyser.getByteFrequencyData(dataArray);
        
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        
        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        gradient.addColorStop(0, 'rgba(26, 31, 44, 0.3)');
        gradient.addColorStop(1, 'rgba(20, 24, 36, 0.3)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        
        const barWidth = (WIDTH / bufferLength) * 2;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * HEIGHT * 0.8;
          
          // Dynamic color based on frequency and amplitude
          const h = (i / bufferLength) * 300 + 240; // Color hue (blue-purple)
          const s = 90; // Saturation
          const l = 50 + (dataArray[i] / 255) * 30; // Brightness
          
          ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, 0.8)`;
          
          // Draw a rounded bar
          const roundedBarHeight = Math.max(4, barHeight);
          
          // Mirror effect for bars
          // Top bar
          ctx.beginPath();
          ctx.roundRect(x, HEIGHT/2 - roundedBarHeight, barWidth - 1, roundedBarHeight, 3);
          ctx.fill();
          
          // Bottom bar (mirror effect)
          ctx.beginPath();
          ctx.roundRect(x, HEIGHT/2, barWidth - 1, roundedBarHeight * 0.7, 3);
          ctx.fill();
          
          x += barWidth;
        }
      }
      
      // Clean up any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      // Start new animation
      renderFrame();
    } else if (animationRef.current) {
      // Stop animation if not playing or not visible
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, [isPlaying, isVisible]);
  
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
