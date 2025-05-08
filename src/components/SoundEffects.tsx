
import { useEffect, useRef, useState } from 'react';

export type SoundType = 'correct' | 'wrong' | 'gameover' | 'timer';

interface SoundEffectsProps {
  sound: SoundType | null;
  onSoundEnd?: () => void;
}

export const SoundEffects: React.FC<SoundEffectsProps> = ({ sound, onSoundEnd }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Map of sound types to their audio files
  const soundMap: Record<SoundType, string> = {
    correct: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3',
    wrong: 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3',
    gameover: 'https://assets.mixkit.co/sfx/preview/mixkit-game-over-dark-orchestra-633.mp3',
    timer: 'https://assets.mixkit.co/sfx/preview/mixkit-tick-tock-timer-606.mp3'
  };

  // Clean up function to properly dispose of audio elements
  const cleanupAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    // Only create a new audio instance if we have a sound to play and we're not already playing
    if (sound && soundMap[sound] && !isPlaying) {
      // Clean up any existing audio before creating a new one
      cleanupAudio();
      
      // Create and configure a new audio element
      const audio = new Audio(soundMap[sound]);
      audioRef.current = audio;
      
      // Set volume based on sound type
      audio.volume = sound === 'timer' ? 0.3 : 0.5;
      
      // Set playing state to true
      setIsPlaying(true);
      
      console.log(`Playing sound: ${sound}`); // Add logging
      
      // Play the sound immediately
      const playSound = async () => {
        try {
          await audio.play();
          console.log(`Sound ${sound} started playing`);
        } catch (err) {
          console.error("Error playing sound:", err);
          // If there's an error, clean up and notify parent
          cleanupAudio();
          if (onSoundEnd) {
            onSoundEnd();
          }
        }
      };
      
      playSound();

      // Handle sound ending
      audio.onended = () => {
        console.log(`Sound ${sound} ended`);
        cleanupAudio();
        if (onSoundEnd) {
          onSoundEnd();
        }
      };

      // Additional error handling
      audio.onerror = (e) => {
        console.error(`Error with sound ${sound}:`, e);
        cleanupAudio();
        if (onSoundEnd) {
          onSoundEnd();
        }
      };

      // Cleanup function when component unmounts or effect re-runs
      return cleanupAudio;
    }
  }, [sound, onSoundEnd]);

  // Additional cleanup on unmount
  useEffect(() => {
    return cleanupAudio;
  }, []);

  return null; // This component doesn't render anything
};
