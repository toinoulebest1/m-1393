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
  album_name?: string;
  duration?: string;
}) => {
  if ('mediaSession' in navigator) {
    console.log('Updating MediaSession metadata for:', song.title);
    
    // URL pointant vers le service de rendu d'images de Supabase pour permettre le redimensionnement
    const supabaseLogoRenderUrl = 'https://pwknncursthenghqgevl.supabase.co/storage/v1/render/image/public/logo/logo.png';
    const sizes = [96, 128, 192, 256, 384, 512];

    const artwork = sizes.map(size => ({
      src: song.imageUrl || `${supabaseLogoRenderUrl}?width=${size}&height=${size}`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    }));

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album_name || song.genre || 'Unknown Album',
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
    console.warn(`MediaSession update bloquée: durée invalide (${duration})`);
    return; // Bloque la mise à jour si la durée n'est pas fiable.
  }

  // GARDE DE SÉCURITÉ : Ne jamais envoyer une position > durée
  const safePosition = isNaN(position) ? 0 : position;
  if (safePosition > duration) {
    console.warn(`MediaSession update bloquée: position (${safePosition.toFixed(2)}) > durée (${duration.toFixed(2)})`);
    return; // Bloque si la position dépasse la durée
  }

  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        position: safePosition,
        playbackRate: playbackRate || 1
      });
    } catch (error) {
      console.error('Error updating position state:', error);
    }
  }
};

// Format duration string to seconds
export const durationToSeconds = (duration: any): number => {
  if (duration === null || duration === undefined) return 0;
  if (typeof duration === 'number') return isNaN(duration) ? 0 : duration;
  if (typeof duration !== 'string') return 0;

  try {
    if (duration.includes(':')) {
      const parts = duration.split(':').map(Number);
      if (parts.some(isNaN)) return 0;
      
      let seconds = 0;
      if (parts.length === 2) { // MM:SS
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) { // HH:MM:SS
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      return seconds;
    }
    
    const durationInSeconds = parseFloat(duration);
    return isNaN(durationInSeconds) ? 0 : durationInSeconds;
  } catch (error) {
    console.error("Error converting duration to seconds:", error);
    return 0;
  }
};