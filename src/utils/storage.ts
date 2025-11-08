import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, isDropboxEnabledForReading, uploadFileToDropbox, getDropboxSharedLink } from './dropboxStorage';
import { generateAndSaveDropboxLinkAdvanced } from './dropboxLinkGenerator';
import { getDropboxConfig } from './dropboxStorage';
import { getTidalStreamUrl } from '@/services/tidalService';

export const uploadAudioFile = async (file: File, fileName: string): Promise<string> => {
  // Priorité à Dropbox si activé
  if (isDropboxEnabled()) {
    console.log('Using Dropbox for file upload');
    const dropboxPath = await uploadFileToDropbox(file, `audio/${fileName}`);
    
    try {
      const config = getDropboxConfig();
      if (config.accessToken) {
        console.log('🔗 Génération immédiate du lien partagé...');
        await generateAndSaveDropboxLinkAdvanced(fileName, dropboxPath, config.accessToken);
        console.log('✅ Lien partagé pré-généré avec succès');
      }
    } catch (error) {
      console.warn('⚠️ Échec génération lien partagé immédiat:', error);
    }
    
    return dropboxPath;
  }
  
  // Fallback vers Supabase
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
  const tidalId = filePath?.startsWith('tidal:') ? filePath.split(':')[1] : undefined;

  if (tidalId) {
    console.log(`[storage.getAudioFileUrl] Tidal ID détecté: ${tidalId}. Tentative de récupération via getTidalStreamUrl...`);
    try {
      const result = await getTidalStreamUrl(tidalId);
      if (result?.url) {
        console.log('[storage.getAudioFileUrl] ✅ URL de stream Tidal récupérée avec succès.');
        return { url: result.url };
      }
      console.warn('[storage.getAudioFileUrl] ⚠️ getTidalStreamUrl n\'a pas retourné d\'URL. Fallback...');
    } catch (error) {
      console.warn('[storage.getAudioFileUrl] ⚠️ Erreur lors de la récupération de l\'URL Tidal, fallback vers les sources locales:', error);
    }
  }
  
  console.log('[storage.getAudioFileUrl] Pas une piste Tidal ou fallback. Traitement comme fichier local (Supabase/Dropbox) pour filePath:', filePath);

  // Logique pour les fichiers locaux uniquement (Supabase/Dropbox)
  
  // Tenter Dropbox si activé
  if (isDropboxEnabledForReading() && songId) {
    console.log('[storage.getAudioFileUrl] Dropbox est activé pour la lecture. Tentative de récupération du lien partagé Dropbox pour songId:', songId);
    try {
      const dropboxUrl = await getDropboxSharedLink(songId);
      if (dropboxUrl) {
        console.log('✅ URL Dropbox récupérée.');
        return { url: dropboxUrl };
      }
      console.log('⚠️ Aucun lien Dropbox partagé trouvé pour songId:', songId, '. Fallback vers Supabase.');
    } catch (error) {
      console.warn('⚠️ Échec de la récupération du lien Dropbox, fallback vers Supabase:', error);
    }
  } else {
    console.log('[storage.getAudioFileUrl] Dropbox n\'est pas activé pour la lecture ou songId manquant. Passage direct à Supabase.');
  }

  // Fallback vers Supabase Storage
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