
import { supabase } from '@/integrations/supabase/client';
import { ensureAudioBucketExists } from './audioBucketSetup';
import { isOneDriveEnabled, uploadFileToOneDrive, getOneDriveSharedLink, checkFileExistsOnOneDrive } from './oneDriveStorage';
import { StorageProvider } from '@/types/onedrive';

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

    // Fallback à Supabase
    console.log("Récupération du fichier audio depuis Supabase:", fileId);
    const { data } = await supabase.storage
      .from('audio')
      .getPublicUrl(fileId);

    if (!data) {
      console.error('Erreur lors de la récupération du fichier depuis Supabase: Aucune donnée renvoyée');
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

// Fonctions pour la gestion des playlists
export const storePlaylistCover = async (playlistId: string, file: File): Promise<string | null> => {
  try {
    // Vérifier si OneDrive est activé
    if (isOneDriveEnabled()) {
      console.log("Utilisation de OneDrive pour stocker la couverture de playlist");
      try {
        await uploadFileToOneDrive(file, `playlists/cover_${playlistId}`);
        const sharedLink = await getOneDriveSharedLink(`playlists/cover_${playlistId}`);
        return sharedLink;
      } catch (error) {
        console.error('Erreur lors du stockage de la couverture sur OneDrive:', error);
        // Fallback to Supabase
      }
    }
    
    // Fallback à Supabase
    console.log("Utilisation de Supabase pour stocker la couverture de playlist");
    
    // Vérifier et créer le bucket si nécessaire
    try {
      const { data, error } = await supabase.storage.getBucket('playlists');
      if (error && (error as any).code === '404') {
        // Le bucket n'existe pas, le créer
        await supabase.storage.createBucket('playlists', {
          public: true
        });
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du bucket playlists:', error);
    }

    const filePath = `cover_${playlistId}`;
    
    // Upload de l'image
    const { error } = await supabase.storage
      .from('playlists')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Erreur lors du stockage de la couverture de playlist:', error);
      return null;
    }

    // Récupérer l'URL
    const { data } = await supabase.storage
      .from('playlists')
      .getPublicUrl(filePath);

    if (!data) {
      return null;
    }
    
    return data.publicUrl;
  } catch (error) {
    console.error('Erreur lors du stockage de la couverture de playlist:', error);
    return null;
  }
};

export const generateImageFromSongs = async (songs: Array<any>): Promise<string | null> => {
  try {
    // Utiliser la première chanson ayant une image, sinon générer une image par défaut
    for (const song of songs) {
      if (song.imageUrl && song.imageUrl !== "https://picsum.photos/240/240") {
        return song.imageUrl;
      }
    }
    
    // Si aucune image n'est trouvée, générer une couleur aléatoire
    const randomColor = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const color = `#${randomColor()}${randomColor()}${randomColor()}`;
    
    // Créer une image avec cette couleur
    return `https://placehold.co/400x400/${color.substring(1)}/ffffff?text=Playlist`;
  } catch (error) {
    console.error('Erreur lors de la génération de l\'image de playlist:', error);
    return null;
  }
};

// Fonction pour obtenir le provider de stockage actuellement utilisé
export const getCurrentStorageProvider = (): StorageProvider => {
  if (isOneDriveEnabled()) {
    return 'onedrive';
  }
  return 'supabase';
};
