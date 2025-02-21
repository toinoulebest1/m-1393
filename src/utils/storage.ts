
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
    // Appeler la fonction Edge pour obtenir le flux audio sécurisé
    const { data, error } = await supabase.functions.invoke('stream-audio', {
      body: { path }
    });

    if (error) {
      console.error("Erreur lors de la récupération du fichier:", error);
      throw error;
    }

    if (!data?.url) {
      throw new Error("URL de streaming non générée");
    }

    console.log("Streaming URL generated successfully");
    return data.url;
  } catch (error) {
    console.error("Erreur lors de la récupération du fichier:", error);
    throw error;
  }
};
