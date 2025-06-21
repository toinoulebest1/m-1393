
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

// Alias pour compatibilité avec l'ancien nom
export const getAudioFile = getAudioFileUrl;

// Fonction pour stocker les fichiers audio (alias pour uploadAudioFile)
export const storeAudioFile = async (fileId: string, file: File): Promise<string> => {
  return await uploadAudioFile(file, fileId);
};

// Fonction de recherche Deezer
export const searchDeezerTrack = async (artist: string, title: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('deezer-search', {
      body: { 
        query: `${artist} ${title}`,
        type: 'track'
      }
    });

    if (error) {
      console.error('Erreur recherche Deezer:', error);
      return null;
    }

    if (data?.data && data.data.length > 0) {
      const track = data.data[0];
      return track.album?.cover_medium || track.album?.cover_big || null;
    }

    return null;
  } catch (error) {
    console.error('Erreur lors de la recherche Deezer:', error);
    return null;
  }
};

// Fonctions pour les pochettes de playlist
export const storePlaylistCover = async (playlistId: string, file: File): Promise<string> => {
  const fileName = `playlist_${playlistId}_${Date.now()}`;
  
  if (isDropboxEnabled()) {
    return await uploadFileToDropbox(file, `playlist-covers/${fileName}`);
  } else if (isOneDriveEnabled()) {
    return await uploadFileToOneDrive(file, `playlist-covers/${fileName}`);
  } else {
    const { data, error } = await supabase.storage
      .from('playlist-covers')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      throw error;
    }

    return data.path;
  }
};

export const generateImageFromSongs = async (songs: any[]): Promise<string> => {
  // Fonction pour générer une image de playlist à partir des chansons
  // Pour l'instant, retourner une image par défaut
  return "https://picsum.photos/400/400";
};
