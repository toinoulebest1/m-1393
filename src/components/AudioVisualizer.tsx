
import React, { useRef, useEffect, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { X } from 'lucide-react';

interface AudioVisualizerProps {
  isVisible: boolean;
  onClose?: () => void;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isVisible, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isPlaying } = usePlayer();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Nettoyage complet lors du démontage
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          if (sourceRef.current) sourceRef.current.disconnect();
          if (analyserRef.current) analyserRef.current.disconnect();
          audioContextRef.current.close();
        } catch (error) {
          console.error("Erreur lors de la fermeture du contexte audio:", error);
        }
      }
    };
  }, []);
  
  useEffect(() => {
    // Ne pas continuer si le visualiseur n'est pas visible
    if (!isVisible) return;
    
    // Récupérer l'élément canvas
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas non trouvé");
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Impossible d'obtenir le contexte 2D");
      return;
    }
    
    // Dessine un fond pour montrer que le canvas est bien initialisé
    ctx.fillStyle = 'rgba(30, 30, 50, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Trouver l'élément audio
    const audioElement = document.querySelector('audio');
    if (!audioElement) {
      console.error("Élément audio non trouvé");
      return;
    }
    
    // Initialiser le contexte audio s'il n'existe pas
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log("Contexte audio créé avec succès");
      } catch (error) {
        console.error("Erreur lors de la création du contexte audio:", error);
        return;
      }
    }
    
    // Configuration de l'analyseur
    if (!analyserRef.current) {
      try {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        console.log("Analyseur audio créé avec succès");
      } catch (error) {
        console.error("Erreur lors de la création de l'analyseur:", error);
        return;
      }
    }
    
    // Ne pas reconnecter si déjà connecté
    if (!isConnected) {
      try {
        // Connecter à l'élément audio
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
        setIsConnected(true);
        console.log("Source audio connectée avec succès");
      } catch (error) {
        console.error("Erreur lors de la connexion à la source audio:", error);
        // Si on est déjà connecté, on continue quand même
      }
    }
    
    // Fonction d'animation pour la visualisation
    const renderFrame = () => {
      if (!isVisible || !isPlaying) {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        return;
      }
      
      animationRef.current = requestAnimationFrame(renderFrame);
      
      const analyser = analyserRef.current;
      if (!analyser) return;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);
      
      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;
      
      // Effacer le canvas
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      
      // Fond avec gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, 'rgba(26, 31, 44, 0.5)');
      gradient.addColorStop(1, 'rgba(20, 24, 36, 0.5)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      // Dessiner les barres de visualisation
      const barWidth = (WIDTH / bufferLength) * 2.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        // Hauteur basée sur les données de fréquence
        const barHeight = (dataArray[i] / 255) * HEIGHT * 0.8;
        
        // Couleur dynamique basée sur la fréquence et l'amplitude
        const h = (i / bufferLength) * 260 + 220; // Teinte (bleu-violet)
        const s = 90; // Saturation
        const l = 50 + (dataArray[i] / 255) * 30; // Luminosité
        
        ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, 0.8)`;
        
        // Dessiner une barre arrondie
        const roundedBarHeight = Math.max(4, barHeight);
        
        // Effet miroir pour les barres
        // Barre supérieure
        ctx.beginPath();
        ctx.roundRect(x, HEIGHT/2 - roundedBarHeight, barWidth - 1, roundedBarHeight, 3);
        ctx.fill();
        
        // Barre inférieure (effet miroir)
        ctx.beginPath();
        ctx.roundRect(x, HEIGHT/2, barWidth - 1, roundedBarHeight * 0.7, 3);
        ctx.fill();
        
        x += barWidth;
      }
    };
    
    // Démarrer l'animation seulement si en cours de lecture
    if (isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      renderFrame();
      console.log("Animation du visualiseur démarrée");
    }
    
  }, [isVisible, isPlaying, isConnected]);
  
  // Ne rien afficher si le visualiseur n'est pas visible
  if (!isVisible) return null;
  
  return (
    <div className="fixed inset-x-0 bottom-24 flex justify-center z-40 px-4">
      <div className="w-full max-w-4xl relative">
        {/* Bouton de fermeture (croix) */}
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all z-10"
          aria-label="Fermer le visualiseur"
        >
          <X className="w-4 h-4" />
        </button>
        
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
