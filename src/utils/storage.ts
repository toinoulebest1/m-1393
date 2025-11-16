import { supabase } from '@/integrations/supabase/client';
import { getMusicStreamUrl, detectProviderFromUrl } from '@/services/musicService';

export const uploadAudioFile = async (file: File, fileName: string): Promise<string> => {
  console.log('Using Supabase for file upload');
  const { data, error } = await supabase.storage
    .from('audio')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }

  return data.path;
};

export const getAudioFileUrl = async (filePath: string, songTitle?: string, songArtist?: string, songId?: string): Promise<{ url: string; duration?: number }> => {
  console.log(`[storage.getAudioFileUrl] Début de la récupération pour filePath: "${filePath}" (Titre: ${songTitle || 'N/A'}, Artiste: ${songArtist || 'N/A'}, ID: ${songId || 'N/A'})`);

  // Cette fonction est maintenant dédiée aux fichiers locaux.
  // Les URLs directes (http/https) et les IDs Tidal sont gérés par UltraFastStreaming.

  // Supabase Storage
  console.log('[storage.getAudioFileUrl] Tentative de récupération de l\'URL signée Supabase pour filePath:', filePath);
  try {
    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error('❌ Erreur Supabase Storage lors de la création de l\'URL signée:', error);
      throw new Error(`Impossible de récupérer le fichier audio depuis Supabase: ${error.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error('Fichier audio introuvable ou URL signée non générée par Supabase.');
    }

    console.log('✅ URL Supabase récupérée (fichier local).');
    return { url: data.signedUrl };
  } catch (error) {
    console.error('❌ Erreur finale lors de la récupération de la musique:', error);
    throw error;
  }
};

// Legacy alias for backward compatibility
export const getAudioFile = getAudioFileUrl;
export const storeAudioFile = uploadAudioFile;

export const storePlaylistCover = async (playlistId: string, coverDataUrl: string): Promise<string> => {
  // Convert data URL to File
  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const coverFile = dataURLtoFile(coverDataUrl, `playlist-${playlistId}-cover.jpg`);
  const fileName = `playlist-covers/${playlistId}.jpg`;
  
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(fileName, coverFile, {
      upsert: true,
      contentType: 'image/jpeg'
    });
  
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage
    .from('media')
    .getPublicUrl(fileName);
  
  return publicUrl;
};

export const generateImageFromSongs = async (songs: any[]): Promise<string> => {
  // Placeholder - implement image generation from songs
  console.warn('generateImageFromSongs not implemented yet');
  return '';
};