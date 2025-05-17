
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GofileUploadResponse {
  status: string;
  data: {
    downloadPage: string;
    code: string;
    parentFolder: string;
    fileId: string;
    fileName: string;
    md5: string;
    directLink: string;
    info: string;
  };
}

// Fonction pour vérifier si Gofile est configuré et activé
export const isGofileEnabled = (): boolean => {
  // Pour l'instant, nous retournons simplement true car nous n'avons pas
  // de configuration particulière requise pour Gofile
  return true;
};

// Fonction pour uploader un fichier audio sur Gofile
export const uploadToGofile = async (file: File): Promise<string> => {
  try {
    console.log("Uploading to Gofile:", file.name);
    
    // Créer un FormData pour l'upload
    const formData = new FormData();
    formData.append('file', file);
    
    // Faire une requête POST à l'API Gofile
    const response = await fetch('https://api.gofile.io/uploadFile', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result: GofileUploadResponse = await response.json();
    
    if (result.status !== 'ok') {
      throw new Error(`Erreur Gofile: ${result.status}`);
    }
    
    console.log("Gofile upload successful:", result.data);
    
    // Retourner le lien direct
    return result.data.directLink;
  } catch (error) {
    console.error("Erreur lors de l'upload vers Gofile:", error);
    toast.error("Erreur lors de l'upload vers Gofile");
    throw error;
  }
};

// Fonction pour stocker les informations du fichier Gofile dans la base de données
export const storeGofileReference = async (
  songId: string, 
  gofileUrl: string
): Promise<void> => {
  try {
    // Ensure songId is a UUID string with the correct format
    if (!songId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      throw new Error("Invalid song ID format");
    }

    const { error } = await supabase
      .from('gofile_references')
      .insert({
        song_id: songId,
        gofile_url: gofileUrl,
        created_at: new Date().toISOString()
      });
      
    if (error) {
      throw error;
    }
    
    console.log("Référence Gofile stockée avec succès pour:", songId);
  } catch (error) {
    console.error("Erreur lors du stockage de la référence Gofile:", error);
    toast.error("Erreur lors du stockage de la référence Gofile");
    throw error;
  }
};

// Fonction pour vérifier si un fichier existe déjà sur Gofile
export const checkFileExistsOnGofile = async (gofileUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(gofileUrl, {
      method: 'HEAD'
    });
    return response.ok;
  } catch (error) {
    console.error("Erreur lors de la vérification du fichier Gofile:", error);
    return false;
  }
};
