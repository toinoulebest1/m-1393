
/**
 * Utility functions for MediaSession API
 */

// Update media session metadata
export const updateMediaSessionMetadata = (song: {
  title: string;
  artist: string;
  imageUrl?: string;
  genre?: string;
}) => {
  if ('mediaSession' in navigator) {
    console.log('Updating MediaSession metadata for:', song.title);
    
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.genre || 'Unknown Album',
      artwork: [
        {
          src: song.imageUrl || "https://picsum.photos/256/256",
          sizes: '256x256',
          type: 'image/jpeg'
        }
      ]
    });
  }
};

// Update media session position state
export const updatePositionState = (
  duration: number,
  position: number,
  playbackRate: number
) => {
  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    try {
      navigator.mediaSession.setPositionState({
        duration: isNaN(duration) ? 0 : duration,
        position: isNaN(position) ? 0 : position,
        playbackRate: playbackRate || 1
      });
    } catch (error) {
      console.error('Error updating position state:', error);
    }
  }
};

// Format duration string to seconds
export const durationToSeconds = (duration: string | undefined): number => {
  if (!duration) return 0;
  
  try {
    if (duration.includes(':')) {
      const [minutes, seconds] = duration.split(':').map(Number);
      if (isNaN(minutes) || isNaN(seconds)) return 0;
      return (minutes * 60) + seconds;
    }
    
    const durationInSeconds = parseFloat(duration);
    return isNaN(durationInSeconds) ? 0 : durationInSeconds;
  } catch (error) {
    console.error("Error converting duration to seconds:", error);
    return 0;
  }
};

