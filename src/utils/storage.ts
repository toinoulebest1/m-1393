
import { supabase } from '@/integrations/supabase/client';

export const storeAudioFile = async (id: string, file: File | string) => {
  console.log("Stockage du fichier audio:", id);
  
  let fileToUpload: File;
  if (typeof file === 'string') {
    try {
      console.log("Fetching file from URL:", file);
      const response = await fetch(file);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const blob = await response.blob();
      fileToUpload = new File([blob], id, { type: blob.type || 'audio/mpeg' });
    } catch (error) {
      console.error("Erreur lors de la conversion de l'URL en fichier:", error);
      throw error;
    }
  } else {
    fileToUpload = file;
  }

  try {
    console.log("Uploading file to Supabase storage:", id);
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(id, fileToUpload, {
        cacheControl: '3600',
        upsert: true,
        contentType: fileToUpload.type || 'audio/mpeg'
      });

    if (error) {
      console.error("Erreur lors du stockage du fichier:", error);
      throw error;
    }

    console.log("File uploaded successfully:", data);
    return data.path;
  } catch (error) {
    console.error("Erreur lors du stockage du fichier:", error);
    throw error;
  }
};

export const getAudioFile = async (path: string) => {
  console.log("Récupération du fichier audio:", path);
  
  if (!path) {
    console.error("Chemin du fichier non fourni");
    throw new Error("Chemin du fichier non fourni");
  }

  try {
    // First check if the file exists
    const { data: fileExists } = await supabase.storage
      .from('audio')
      .list('', {
        search: path
      });

    if (!fileExists || fileExists.length === 0) {
      console.error("Fichier non trouvé dans le stockage:", path);
      throw new Error("Fichier audio non trouvé");
    }

    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(path, 3600);

    if (error) {
      console.error("Erreur lors de la récupération du fichier:", error);
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error("URL signée non générée");
    }

    console.log("Signed URL generated successfully:", data.signedUrl);
    return data.signedUrl;
  } catch (error) {
    console.error("Erreur lors de la récupération du fichier:", error);
    throw error;
  }
};

export const searchDeezerTrack = async (artist: string, title: string): Promise<string | null> => {
  try {
    const query = `${artist} ${title}`;
    console.log("Recherche Deezer pour:", { artist, title });
    
    const { data: supabaseData, error } = await supabase.functions.invoke('deezer-search', {
      body: { query }
    });
    
    if (error) {
      console.error("Erreur lors de l'appel à l'edge function Deezer:", error);
      return null;
    }

    console.log("Résultat de la recherche Deezer:", supabaseData);
    
    if (supabaseData?.data && supabaseData.data.length > 0) {
      const track = supabaseData.data[0];
      if (track.album?.cover_xl) {
        console.log("Pochette trouvée:", track.album.cover_xl);
        return track.album.cover_xl;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Erreur lors de la recherche Deezer:", error);
    return "https://picsum.photos/240/240";
  }
};

// New function to store playlist cover images
export const storePlaylistCover = async (playlistId: string, file: File | string | Blob) => {
  console.log("Stockage de la pochette de playlist:", playlistId);
  
  try {
    let fileToUpload: File;
    
    if (file instanceof Blob) {
      fileToUpload = new File([file], `playlist-${playlistId}.jpg`, { 
        type: 'image/jpeg' 
      });
    } else if (typeof file === 'string') {
      // Handle data URL or remote URL
      if (file.startsWith('data:')) {
        // Convert data URL to Blob
        const response = await fetch(file);
        const blob = await response.blob();
        fileToUpload = new File([blob], `playlist-${playlistId}.jpg`, { 
          type: 'image/jpeg' 
        });
      } else {
        // Fetch remote URL
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        fileToUpload = new File([blob], `playlist-${playlistId}.jpg`, { 
          type: blob.type || 'image/jpeg' 
        });
      }
    } else {
      fileToUpload = file;
    }
    
    const fileName = `playlist-covers/${playlistId}.jpg`;
    
    console.log("Uploading playlist cover to storage:", fileName);
    const { data, error } = await supabase.storage
      .from('media')
      .upload(fileName, fileToUpload, {
        upsert: true,
        contentType: fileToUpload.type || 'image/jpeg'
      });
    
    if (error) {
      console.error("Erreur lors du stockage de la pochette:", error);
      throw error;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);
    
    console.log("Playlist cover uploaded successfully:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Erreur lors du stockage de la pochette:", error);
    throw error;
  }
};
