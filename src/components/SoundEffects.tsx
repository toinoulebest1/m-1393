
import { useEffect, useRef, useState } from 'react';

export type SoundType = 'correct' | 'wrong' | 'gameover' | 'timer';

interface SoundEffectsProps {
  sound: SoundType | null;
  onSoundEnd?: () => void;
}

export const SoundEffects: React.FC<SoundEffectsProps> = ({ sound, onSoundEnd }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Map of sound types to their audio files with alternate URLs as fallbacks
  const soundMap: Record<SoundType, string[]> = {
    correct: [
      'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3',
      'https://www.soundjay.com/buttons/sounds/button-16.mp3' // Fallback URL
    ],
    wrong: [
      'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3',
      'https://www.soundjay.com/buttons/sounds/button-10.mp3' // Fallback URL
    ],
    gameover: [
      'https://assets.mixkit.co/sfx/preview/mixkit-game-over-dark-orchestra-633.mp3',
      'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' // Fallback URL
    ],
    timer: [
      'https://assets.mixkit.co/sfx/preview/mixkit-tick-tock-timer-606.mp3',
      'https://www.soundjay.com/mechanical/sounds/timer-tick-01.mp3' // Fallback URL
    ]
  };

  // Clean up function to properly dispose of audio elements
  const cleanupAudio = () => {
    if (audioRef.current) {
      try {
        // Make sure to pause and reset the audio before cleaning up
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
        audioRef.current.load(); // Force reload to clear any resources
        audioRef.current = null;
      } catch (err) {
        console.error("Error during audio cleanup:", err);
      }
      setIsPlaying(false);
    }
  };

  const tryPlaySound = async (soundType: SoundType, urlIndex = 0) => {
    // Make sure we have valid URLs to try
    if (!soundMap[soundType] || urlIndex >= soundMap[soundType].length) {
      console.error(`No valid sound URL found for ${soundType}`);
      setIsPlaying(false);
      if (onSoundEnd) onSoundEnd();
      return;
    }
    
    try {
      // Create a new audio element
      const audio = new Audio();
      audioRef.current = audio;
      
      // Set up event handlers before setting source
      audio.oncanplaythrough = async () => {
        try {
          console.log(`Sound ${soundType} ready to play, starting playback...`);
          await audio.play();
        } catch (err) {
          console.error(`Error playing sound ${soundType}:`, err);
          // Try next URL if available
          cleanupAudio();
          tryPlaySound(soundType, urlIndex + 1);
        }
      };
      
      audio.onended = () => {
        console.log(`Sound ${soundType} ended normally`);
        cleanupAudio();
        if (onSoundEnd) onSoundEnd();
      };
      
      audio.onerror = (e) => {
        console.error(`Error with sound ${soundType} URL ${urlIndex}:`, e);
        // Try next URL if available
        cleanupAudio();
        tryPlaySound(soundType, urlIndex + 1);
      };
      
      audio.onabort = (e) => {
        console.log(`Sound ${soundType} aborted:`, e);
        cleanupAudio();
        if (onSoundEnd) onSoundEnd();
      };
      
      // Set volume based on sound type
      audio.volume = soundType === 'timer' ? 0.3 : 0.5;
      
      // Set the source and load
      console.log(`Attempting to load sound: ${soundType} from ${soundMap[soundType][urlIndex]}`);
      audio.src = soundMap[soundType][urlIndex];
      audio.load(); // Force load
      
      setIsPlaying(true);
    } catch (err) {
      console.error(`Failed to initialize audio for ${soundType}:`, err);
      if (onSoundEnd) onSoundEnd();
    }
  };

  useEffect(() => {
    // Only create a new audio instance if we have a sound to play and we're not already playing
    if (sound && !isPlaying) {
      // Clean up any existing audio before creating a new one
      cleanupAudio();
      
      // Start trying to play the sound
      tryPlaySound(sound);
    }
    
    // Cleanup function when component unmounts or effect re-runs
    return cleanupAudio;
  }, [sound]);

  // Ensure cleanup when component unmounts
  useEffect(() => {
    return cleanupAudio;
  }, []);

  return null; // This component doesn't render anything
};
