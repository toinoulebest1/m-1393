
import { useEffect, useRef } from 'react';

export type SoundType = 'correct' | 'wrong' | 'gameover' | 'timer';

interface SoundEffectsProps {
  sound: SoundType | null;
  onSoundEnd?: () => void;
}

export const SoundEffects: React.FC<SoundEffectsProps> = ({ sound, onSoundEnd }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Map of sound types to their audio files
  const soundMap: Record<SoundType, string> = {
    correct: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3',
    wrong: 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3',
    gameover: 'https://assets.mixkit.co/sfx/preview/mixkit-game-over-dark-orchestra-633.mp3',
    timer: 'https://assets.mixkit.co/sfx/preview/mixkit-tick-tock-timer-606.mp3'
  };

  useEffect(() => {
    if (sound && soundMap[sound]) {
      // Create a new audio element each time
      const audio = new Audio(soundMap[sound]);
      audioRef.current = audio;
      
      // Set volume
      audio.volume = sound === 'timer' ? 0.3 : 0.5;
      
      // Play the sound
      audio.play().catch(err => {
        console.error("Error playing sound:", err);
      });

      // Handle sound ending
      audio.onended = () => {
        if (onSoundEnd) {
          onSoundEnd();
        }
      };

      // Cleanup function
      return () => {
        audio.pause();
        audio.src = '';
      };
    }
  }, [sound, onSoundEnd]);

  return null; // This component doesn't render anything
};
