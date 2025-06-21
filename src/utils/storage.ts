
import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, uploadFileToDropbox, getDropboxSharedLink } from './dropboxStorage';
import { isOneDriveEnabled, uploadFileToOneDrive, getOneDriveSharedLink } from './oneDriveStorage';

export const uploadAudioFile = async (file: File, fileName: string): Promise<string> => {
  // Priorité à Dropbox, puis OneDrive, puis Supabase
  if (isDropboxEnabled()) {
    console.log('Using Dropbox for file upload');
    return await uploadFileToDropbox(file, `audio/${fileName}`);
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
  // Priorité à Dropbox, puis OneDrive, puis Supabase
  if (isDropboxEnabled()) {
    console.log('Getting file URL from Dropbox');
    try {
      return await getDropboxSharedLink(filePath);
    } catch (error) {
      console.error('Error getting Dropbox shared link:', error);
      // Fallback vers Supabase si Dropbox échoue
    }
  } else if (isOneDriveEnabled()) {
    console.log('Getting file URL from OneDrive');
    try {
      return await getOneDriveSharedLink(filePath);
    } catch (error) {
      console.error('Error getting OneDrive shared link:', error);
      // Fallback vers Supabase si OneDrive échoue
    }
  }
  
  console.log('Getting file URL from Supabase');
  // Fallback vers Supabase
  const { data } = await supabase.storage
    .from('audio')
    .createSignedUrl(filePath, 3600);

  if (!data?.signedUrl) {
    throw new Error('Failed to get file URL from Supabase');
  }

  return data.signedUrl;
};

// Legacy alias for backward compatibility
export const getAudioFile = getAudioFileUrl;

// Placeholder functions for missing exports
export const storeAudioFile = uploadAudioFile;

export const searchDeezerTrack = async (query: string): Promise<any> => {
  // Placeholder - implement Deezer search functionality
  console.warn('searchDeezerTrack not implemented yet');
  return null;
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
