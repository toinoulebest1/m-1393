import { supabase } from "@/integrations/supabase/client";

export const storeAudioFile = async (id: string, file: File) => {
  console.log("Stockage du fichier audio:", id);
  const { data, error } = await supabase.storage
    .from('audio')
    .upload(id, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error("Erreur lors du stockage du fichier:", error);
    throw error;
  }

  console.log("Fichier stocké avec succès:", data);
  return data;
};

export const getAudioFile = async (id: string) => {
  console.log("Récupération du fichier audio:", id);
  const { data, error } = await supabase.storage
    .from('audio')
    .createSignedUrl(id, 3600); // URL valide pendant 1 heure

  if (error) {
    console.error("Erreur lors de la récupération du fichier:", error);
    throw error;
  }

  console.log("URL signée générée:", data.signedUrl);
  return data.signedUrl;
};