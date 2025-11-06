/**
 * Utility functions for MediaSession API
 */
import { supabase } from '@/integrations/supabase/client';
// REMOVED: import logoUrl from '@/assets/logo.png';

// Update media session metadata
export const updateMediaSessionMetadata = (song: {
  title: string;
  artist: string;
  imageUrl?: string;
  genre?: string;
  duration?: string;
}) => {
  if ('mediaSession' in navigator) {
    console.log('Updating MediaSession metadata for:', song.title);
    
    const { data: logoData } = supabase.storage.from('logo').getPublicUrl('logo.png');
    const supabaseLogoUrl = logoData.publicUrl;
    const sizes = [96, 128, 192, 256, 384, 512];

    const artwork = sizes.map(size => ({
      src: song.imageUrl || `${supabaseLogoUrl}?width=${size}&height=${size}`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    }));

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.genre || 'Unknown Album',
      artwork: artwork,
    });
  }
};

// Update media session position state
export const updatePositionState = (
  duration: number,
  position: number,
  playbackRate: number
) => {
  // GARDE DE SÉCURITÉ : Ne jamais mettre à jour l'OS avec une durée invalide.
  if (!duration || isNaN(duration) || duration === Infinity || duration <= 0) {
    return; // Bloque la mise à jour si la durée n'est pas fiable.
  }

  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
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