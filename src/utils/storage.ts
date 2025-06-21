
import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadFileToDropbox, getDropboxSharedLink, checkFileExistsOnDropbox } from './dropboxStorage';
import { isOneDriveEnabled, uploadFileToOneDrive, getOneDriveSharedLink } from './oneDriveStorage';

export const uploadAudioFile = async (file: File, fileName: string): Promise<string> => {
  // Priorité à Dropbox, puis OneDrive, puis Supabase
  if (isDropboxEnabled()) {
    console.log('Using Dropbox for file upload');
    return await uploadFileToDropbox(file, fileName);
  } else if (isOneDriveEnabled()) {
    console.log('Using OneDrive for file upload');
    return await uploadFileToOneDrive(file, `audio/${fileName}`);
  } else {
    console.log('Using Supabase for file upload');
    // Fallback vers Supabase
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
  }
};

export const getAudioFileUrl = async (filePath: string): Promise<string> => {
  console.log('🔍 Récupération URL pour:', filePath);
  
  // Priorité à Dropbox, puis OneDrive, puis Supabase
  if (isDropboxEnabled()) {
    console.log('Getting file URL from Dropbox');
    try {
      // Vérifier d'abord si le fichier existe sur Dropbox
      const exists = await checkFileExistsOnDropbox(filePath);
      if (!exists) {
        console.warn('⚠️ Fichier non trouvé sur Dropbox:', filePath);
        throw new Error('File not found on Dropbox');
      }
      
      const url = await getDropboxSharedLink(filePath);
      console.log('✅ URL Dropbox récupérée:', url);
      return url;
    } catch (error) {
      console.error('❌ Erreur Dropbox pour', filePath, ':', error);
      // Continuer vers le fallback
    }
  } else if (isOneDriveEnabled()) {
    console.log('Getting file URL from OneDrive');
    try {
      const url = await getOneDriveSharedLink(filePath);
      console.log('✅ URL OneDrive récupérée:', url);
      return url;
    } catch (error) {
      console.error('❌ Erreur OneDrive pour', filePath, ':', error);
      // Si OneDrive échoue, on continue vers Supabase sans faire échouer complètement
      console.log('OneDrive failed, trying Supabase as fallback...');
    }
  }
  
  console.log('Getting file URL from Supabase');
  try {
    // Vérifier d'abord si le fichier existe dans Supabase
    const { data: listData, error: listError } = await supabase.storage
      .from('audio')
      .list('', {
        search: filePath
      });

    if (listError) {
      console.error('❌ Erreur liste Supabase:', listError);
      throw new Error(`Supabase list error: ${listError.message}`);
    }

    if (!listData || listData.length === 0) {
      console.warn('⚠️ Fichier non trouvé dans Supabase:', filePath);
      throw new Error(`File not found in Supabase storage: ${filePath}`);
    }

    // Créer l'URL signée
    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error('❌ Erreur création URL signée:', error);
      throw new Error(`Supabase signed URL error: ${error.message}`);
    }

    if (!data?.signedUrl) {
      console.error('❌ URL signée vide');
      throw new Error('Failed to get file URL from Supabase');
    }

    console.log('✅ URL Supabase récupérée');
    return data.signedUrl;
  } catch (error) {
    console.error('❌ Erreur complète récupération URL:', error);
    throw new Error(`Unable to retrieve file: ${filePath}. File may not exist in any storage system.`);
  }
};

// Legacy alias for backward compatibility
export const getAudioFile = getAudioFileUrl;

// Placeholder functions for missing exports
export const storeAudioFile = uploadAudioFile;

export const searchDeezerTrack = async (query: string): Promise<string | null> => {
  try {
    console.log(`Recherche Deezer pour: ${query}`);
    
    const { data, error } = await supabase.functions.invoke('deezer-search', {
      body: { query }
    });

    if (error) {
      console.error('Erreur recherche Deezer:', error);
      return null;
    }

    if (data && data.data && data.data.length > 0) {
      const track = data.data[0];
      const coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || track.album?.cover;
      
      console.log(`Pochette Deezer trouvée: ${coverUrl}`);
      return coverUrl;
    }

    console.log('Aucune pochette trouvée sur Deezer');
    return null;
  } catch (error) {
    console.error('Erreur lors de la recherche Deezer:', error);
    return null;
  }
};

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
