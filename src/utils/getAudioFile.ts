
import { supabase } from '@/integrations/supabase/client';

// Fonction utilitaire pour récupérer un fichier audio, que ce soit depuis Dropbox ou Supabase
export async function getAudioFileUrl(path: string): Promise<string> {
  if (!path) {
    throw new Error("Chemin du fichier non fourni");
  }

  try {
    // Vérifier d'abord si c'est un fichier fallback stocké sur Supabase
    const { data: fileRef } = await supabase
      .from('dropbox_files')
      .select('storage_provider, dropbox_path')
      .eq('local_id', path)
      .maybeSingle();
      
    // Si c'est un fichier stocké sur Supabase mais référencé comme Dropbox
    if (fileRef?.storage_provider === 'supabase') {
      const fileName = fileRef.dropbox_path.split('/').pop();
      const { data } = supabase.storage
        .from('audio')
        .getPublicUrl(fileName);
        
      return data.publicUrl;
    }
    
    // Sinon, utiliser la méthode standard pour récupérer le fichier
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(path);
      
    return publicUrl;
  } catch (error) {
    console.error("Erreur lors de la récupération de l'URL du fichier:", error);
    throw error;
  }
}
