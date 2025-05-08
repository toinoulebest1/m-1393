import { useEffect, useRef, useState } from 'react';

export type SoundType = 'correct' | 'wrong' | 'gameover' | 'timer';

interface SoundEffectsProps {
  sound: SoundType | null;
  onSoundEnd?: () => void;
}

export const SoundEffects: React.FC<SoundEffectsProps> = ({ sound, onSoundEnd }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Map of sound types to their audio files with highly reliable URLs as fallbacks
  const soundMap: Record<SoundType, string[]> = {
    correct: [
      'https://www.soundjay.com/buttons/sounds/button-16.mp3',
      'https://www.soundjay.com/buttons/button-09a.mp3',
      'https://www.fesliyanstudios.com/play-mp3/387'
    ],
    wrong: [
      'https://www.soundjay.com/buttons/sounds/button-10.mp3',
      'https://www.soundjay.com/buttons/button-11.mp3',
      'https://www.fesliyanstudios.com/play-mp3/6'
    ],
    gameover: [
      'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
      'https://www.soundjay.com/misc/sounds/fail-buzzer-01.mp3',
      'https://www.fesliyanstudios.com/play-mp3/38'
    ],
    timer: [
      'https://www.soundjay.com/mechanical/sounds/timer-tick-01.mp3',
      'https://www.soundjay.com/mechanical/sounds/clock-ticking-2.mp3',
      'https://www.fesliyanstudios.com/play-mp3/5694'
    ]
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
    
    // Also clean up AudioContext if it exists
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (err) {
        console.error("Error closing audio context:", err);
      }
      audioContextRef.current = null;
    }
  };

  const preloadAudio = (soundType: SoundType) => {
    // Preload all URLs for this sound type to increase chance of success
    soundMap[soundType].forEach(url => {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = url;
        // Don't need to keep a reference, just trigger browser caching
      } catch (e) {
        // Silent fail on preload
      }
    });
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
          // Try to use Web Audio API for more reliable playback
          try {
            // Create a new AudioContext
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioContext;
            
            // Create a MediaElementAudioSourceNode
            const source = audioContext.createMediaElementSource(audio);
            // Connect the source to the destination (speakers)
            source.connect(audioContext.destination);
            
            // Resume the audio context (required by some browsers)
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
            }
          } catch (err) {
            console.warn('Web Audio API not supported, falling back to standard Audio playback', err);
          }
          
          await audio.play();
        } catch (err) {
          console.error(`Error playing sound ${soundType}:`, err);
          // Try next URL if available
          cleanupAudio();
          setTimeout(() => {
            tryPlaySound(soundType, urlIndex + 1);
          }, 300);  // Add delay before trying next URL
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
        setTimeout(() => {
          tryPlaySound(soundType, urlIndex + 1);
        }, 300);  // Add delay before trying next URL
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
      
      // Add credentials and crossOrigin
      audio.crossOrigin = "anonymous";
      
      // Force load
      audio.load(); 
      
      setIsPlaying(true);
    } catch (err) {
      console.error(`Failed to initialize audio for ${soundType}:`, err);
      if (onSoundEnd) onSoundEnd();
    }
  };

  // On mount, preload all sounds to improve playback chances
  useEffect(() => {
    const allSoundTypes: SoundType[] = ['correct', 'wrong', 'gameover', 'timer'];
    allSoundTypes.forEach(preloadAudio);
    
    // Clean up on unmount
    return cleanupAudio;
  }, []);

  useEffect(() => {
    // Only create a new audio instance if we have a sound to play and we're not already playing
    if (sound && !isPlaying) {
      // Clean up any existing audio before creating a new one
      cleanupAudio();
      
      // Start trying to play the sound
      tryPlaySound(sound);
    }
    
    // Cleanup function when component unmounts or effect re-runs
    return () => {};
  }, [sound, isPlaying]);

  return null; // This component doesn't render anything
};
