
import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadFileToDropbox, getDropboxSharedLink, checkFileExistsOnDropbox } from './dropboxStorage';
import { nonExistentFilesCache } from './nonExistentFilesCache';

export const uploadAudioFile = async (file: File, fileName: string): Promise<string> => {
  // Priorité stricte à Dropbox d'abord
  if (isDropboxEnabled()) {
    return await uploadFileToDropbox(file, `audio/${fileName}`);
  }
  
  // Fallback vers Supabase (OneDrive complètement désactivé si Dropbox est configuré)
  const { data, error } = await supabase.storage
    .from('audio')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    throw error;
  }

  return data.path;
};

export const getAudioFileUrl = async (filePath: string): Promise<string> => {
  // Vérification cache des fichiers inexistants AVANT tout traitement
  if (nonExistentFilesCache.isNonExistent(filePath)) {
    throw new Error(`File marked as non-existent: ${filePath}`);
  }
  
  // Priorité stricte à Dropbox d'abord
  if (isDropboxEnabled()) {
    try {
      const exists = await checkFileExistsOnDropbox(filePath);
      if (!exists) {
        // Marquer comme inexistant SANS log
        nonExistentFilesCache.markAsNonExistent(filePath);
        throw new Error(`File not found on Dropbox: ${filePath}`);
      }
      
      const url = await getDropboxSharedLink(filePath);
      return url;
    } catch (error) {
      // Marquer comme inexistant SANS log
      nonExistentFilesCache.markAsNonExistent(filePath);
      // Si Dropbox est activé mais échoue, aller directement vers Supabase
      // Ne pas essayer OneDrive si Dropbox est configuré
    }
  }
  
  // Fallback vers Supabase (OneDrive complètement ignoré si Dropbox est configuré)
  try {
    const { data: listData, error: listError } = await supabase.storage
      .from('audio')
      .list('', {
        search: filePath
      });

    if (listError) {
      nonExistentFilesCache.markAsNonExistent(filePath);
      throw new Error(`Supabase list error: ${listError.message}`);
    }

    if (!listData || listData.length === 0) {
      nonExistentFilesCache.markAsNonExistent(filePath);
      throw new Error(`File not found in Supabase storage: ${filePath}`);
    }

    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(filePath, 3600);

    if (error) {
      nonExistentFilesCache.markAsNonExistent(filePath);
      throw new Error(`Supabase signed URL error: ${error.message}`);
    }

    if (!data?.signedUrl) {
      nonExistentFilesCache.markAsNonExistent(filePath);
      throw new Error('Failed to get file URL from Supabase');
    }

    return data.signedUrl;
  } catch (error) {
    nonExistentFilesCache.markAsNonExistent(filePath);
    throw new Error(`Unable to retrieve file: ${filePath}. File may not exist in any storage system.`);
  }
};

// Legacy alias for backward compatibility
export const getAudioFile = getAudioFileUrl;
export const storeAudioFile = uploadAudioFile;

export const searchDeezerTrack = async (query: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('deezer-search', {
      body: { query }
    });

    if (error) {
      return null;
    }

    if (data && data.data && data.data.length > 0) {
      const track = data.data[0];
      const coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || track.album?.cover;
      
      return coverUrl;
    }

    return null;
  } catch (error) {
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
  return '';
};
