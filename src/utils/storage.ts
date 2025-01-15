import { supabase } from "@/integrations/supabase/client";

export const storeAudioFile = async (id: string, file: File | string) => {
  console.log("Stockage du fichier audio:", id);
  
  // If file is a string (URL), fetch it first
  let fileToUpload: File;
  if (typeof file === 'string') {
    try {
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

  // First try to get the file to see if it exists
  const { data: existingFile } = await supabase.storage
    .from('audio')
    .list('', {
      search: id
    });

  // If file doesn't exist, upload it
  if (!existingFile || existingFile.length === 0) {
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(id, fileToUpload, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error("Erreur lors du stockage du fichier:", error);
      throw error;
    }

    console.log("Fichier stocké avec succès:", data);
    return data;
  }

  console.log("Le fichier existe déjà dans le stockage");
  return existingFile[0];
};

export const getAudioFile = async (id: string) => {
  console.log("Récupération du fichier audio:", id);
  
  // First check if the file exists
  const { data: existingFile } = await supabase.storage
    .from('audio')
    .list('', {
      search: id
    });

  if (!existingFile || existingFile.length === 0) {
    console.error("Fichier non trouvé dans le stockage:", id);
    throw new Error('Fichier audio non trouvé');
  }

  // Get a signed URL that's valid for 1 hour
  const { data, error } = await supabase.storage
    .from('audio')
    .createSignedUrl(id, 3600);

  if (error) {
    console.error("Erreur lors de la récupération du fichier:", error);
    throw error;
  }

  console.log("URL signée générée:", data.signedUrl);
  return data.signedUrl;
};