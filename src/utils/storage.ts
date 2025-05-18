import { supabase } from '@/integrations/supabase/client';
import { getAudioUrl as getDropboxAudioUrl, isDropboxEnabled, storeAudioFile as storeDropboxAudioFile } from './dropboxStorage';
import { ensureAudioBucketExists } from './audioBucketSetup';
import { isOneDriveEnabled, uploadFileToOneDrive, getOneDriveSharedLink, checkFileExistsOnOneDrive } from './oneDriveStorage';

export const storeAudioFile = async (id: string, file: File, onProgress?: (progress: number) => void): Promise<void> => {
  // Vérifier si OneDrive est activé
  if (isOneDriveEnabled()) {
    console.log("Utilisation de OneDrive pour stocker le fichier audio");
    try {
      await uploadFileToOneDrive(file, `audio/${id}`);
      if (onProgress) onProgress(100);
    } catch (error) {
      console.error('Erreur lors du stockage du fichier sur OneDrive:', error);
      throw error;
    }
    return;
  }
  
  // Vérifier si Dropbox est activé
  if (isDropboxEnabled()) {
    console.log("Utilisation de Dropbox pour stocker le fichier audio");
    try {
      await storeDropboxAudioFile(id, file);
      if (onProgress) onProgress(100);
    } catch (error) {
      console.error('Erreur lors du stockage du fichier sur Dropbox:', error);
      throw error;
    }
    return;
  }

  // Fallback à Supabase
  console.log("Utilisation de Supabase pour stocker le fichier audio");
  try {
    // Vérifier et créer le bucket si nécessaire
    await ensureAudioBucketExists();

    // Upload du fichier avec progress tracking
    const options = onProgress ? {
      onUploadProgress: (progress: number) => {
        const percentage = Math.round(progress * 100);
        onProgress(percentage);
      }
    } : undefined;

    const { error } = await supabase.storage
      .from('audio')
      .upload(id, file, {
        cacheControl: '3600',
        upsert: true,
        ...options
      });

    if (error) {
      console.error('Erreur lors du stockage du fichier sur Supabase:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erreur lors du stockage du fichier sur Supabase:', error);
    throw error;
  }
};

export const getAudioFile = async (fileId: string): Promise<string | null> => {
  try {
    // Vérifier si OneDrive est activé
    if (isOneDriveEnabled()) {
      console.log("Récupération du fichier audio depuis OneDrive:", fileId);
      try {
        // Vérifier si le fichier existe sur OneDrive
        const fileExists = await checkFileExistsOnOneDrive(`audio/${fileId}`);
        
        if (!fileExists) {
          console.error("Fichier non trouvé sur OneDrive:", fileId);
          return null;
        }
        
        // Obtenir un lien partagé
        const sharedLink = await getOneDriveSharedLink(`audio/${fileId}`);
        console.log("Lien OneDrive obtenu:", sharedLink);
        return sharedLink;
      } catch (error) {
        console.error("Erreur lors de la récupération du fichier depuis OneDrive:", error);
        return null;
      }
    }
    
    // Vérifier si Dropbox est activé
    if (isDropboxEnabled()) {
      console.log("Récupération du fichier audio depuis Dropbox:", fileId);
      return getDropboxAudioUrl(fileId);
    }

    // Fallback à Supabase
    console.log("Récupération du fichier audio depuis Supabase:", fileId);
    const { data, error } = await supabase.storage
      .from('audio')
      .getPublicUrl(fileId);

    if (error) {
      console.error('Erreur lors de la récupération du fichier depuis Supabase:', error);
      return null;
    }

    return data.publicUrl;
  } catch (error) {
    console.error("Erreur lors de la récupération du fichier audio:", error);
    return null;
  }
};

export const searchDeezerTrack = async (artist: string, title: string): Promise<string | null> => {
  try {
    const searchTerm = `${artist} ${title}`;
    const apiUrl = `https://api.deezer.com/search?q=${encodeURIComponent(searchTerm)}&limit=1`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error('Erreur lors de la recherche sur Deezer:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const track = data.data[0];
      return track.album.cover_xl;
    } else {
      console.log('Aucun résultat trouvé sur Deezer pour:', searchTerm);
      return null;
    }
  } catch (error) {
    console.error('Erreur lors de la recherche sur Deezer:', error);
    return null;
  }
};
