
import { useEffect, useRef, useState } from 'react';

export type SoundType = 'correct' | 'wrong' | 'gameover' | 'timer';

interface SoundEffectsProps {
  sound: SoundType | null;
  onSoundEnd?: () => void;
}

export const SoundEffects: React.FC<SoundEffectsProps> = ({ sound, onSoundEnd }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Map of sound types to their file paths
  const soundMap: Record<SoundType, string> = {
    correct: '/sounds/correct.mp3',
    wrong: '/sounds/wrong.mp3',
    gameover: '/sounds/gameover.mp3',
    timer: '/sounds/timer.mp3'
  };

  // Clean up function to properly dispose of audio elements
  const cleanupAudio = () => {
    if (audioRef.current) {
      try {
        // Make sure to pause and reset the audio before cleaning up
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.oncanplaythrough = null;
        audioRef.current.onabort = null;
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

  // Preload all sounds to ensure they're cached
  const preloadSounds = () => {
    Object.values(soundMap).forEach(soundSrc => {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = soundSrc;
        // Just trigger the load but don't play
        audio.load();
        // Remove the reference to allow garbage collection
        setTimeout(() => {
          audio.src = '';
          audio.load();
        }, 1000);
      } catch (err) {
        console.error(`Error preloading sound ${soundSrc}:`, err);
      }
    });
  };

  const tryPlaySound = (soundType: SoundType) => {
    try {
      console.log(`Attempting to play sound: ${soundType} from ${soundMap[soundType]}`);
      
      // Create a new audio element
      const audio = new Audio();
      audioRef.current = audio;
      
      // Set up event handlers before setting source
      audio.oncanplaythrough = () => {
        try {
          console.log(`Sound ${soundType} ready to play, starting playback...`);
          audio.play().catch(err => {
            console.error(`Error playing sound ${soundType}:`, err);
            cleanupAudio();
            if (onSoundEnd) onSoundEnd();
          });
        } catch (err) {
          console.error(`Error playing sound ${soundType}:`, err);
          cleanupAudio();
          if (onSoundEnd) onSoundEnd();
        }
      };
      
      audio.onended = () => {
        console.log(`Sound ${soundType} ended normally`);
        cleanupAudio();
        if (onSoundEnd) onSoundEnd();
      };
      
      audio.onerror = (e) => {
        console.error(`Error with sound ${soundType}:`, e);
        
        // Try to provide more detailed error information
        let errorMessage = "Unknown error";
        if (audio.error) {
          errorMessage = `Code: ${audio.error.code}, Message: ${audio.error.message}`;
        }
        console.error(`Audio error details: ${errorMessage}`);
        
        cleanupAudio();
        if (onSoundEnd) onSoundEnd();
      };
      
      audio.onabort = () => {
        console.log(`Sound ${soundType} playback aborted`);
        cleanupAudio();
        if (onSoundEnd) onSoundEnd();
      };
      
      // Set volume based on sound type
      audio.volume = soundType === 'timer' ? 0.3 : 0.5;
      
      // Set the source and load
      audio.src = soundMap[soundType];
      
      // Force load
      audio.load();
      
      setIsPlaying(true);
    } catch (err) {
      console.error(`Failed to initialize audio for ${soundType}:`, err);
      if (onSoundEnd) onSoundEnd();
    }
  };

  // On mount, preload all sounds
  useEffect(() => {
    // Preload sounds on component mount
    preloadSounds();
    
    // Clean up on unmount
    return cleanupAudio;
  }, []);

  useEffect(() => {
    // Only create a new audio instance if we have a sound to play and we're not already playing
    if (sound && !isPlaying) {
      // Clean up any existing audio before creating a new one
      cleanupAudio();
      
      // Wait a moment to ensure cleanup is complete
      setTimeout(() => {
        // Start trying to play the sound
        tryPlaySound(sound);
      }, 100);
    }
    
    // Cleanup function when component unmounts or effect re-runs
    return () => {};
  }, [sound, isPlaying]);

  return null; // This component doesn't render anything
};
