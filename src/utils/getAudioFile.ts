
import { supabase } from '@/integrations/supabase/client';

// Fonction utilitaire pour récupérer un fichier audio, que ce soit depuis Dropbox ou Supabase
export async function getAudioFileUrl(path: string): Promise<string> {
  if (!path) {
    throw new Error("Chemin du fichier non fourni");
  }

  try {
    // Vérifier d'abord si c'est un fichier stocké sur Dropbox
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
    
    // Si c'est un fichier stocké sur Dropbox
    if (fileRef?.storage_provider === 'dropbox' || fileRef?.dropbox_path) {
      try {
        // Utiliser l'edge function pour récupérer le lien partagé
        const { data, error } = await supabase.functions.invoke('dropbox-storage', {
          method: 'POST',
          body: {
            action: 'get',
            path: fileRef.dropbox_path || path
          }
        });
        
        if (error || !data?.url) {
          console.log("Échec de la récupération depuis Dropbox, tentative avec Supabase");
          throw error || new Error("URL Dropbox non disponible");
        }
        
        return data.url;
      } catch (dropboxError) {
        console.warn("Erreur Dropbox, tentative avec Supabase:", dropboxError);
        // Si le fichier n'est pas trouvé sur Dropbox, essayer avec Supabase
      }
    }
    
    // Essayer avec la méthode standard pour récupérer le fichier depuis Supabase
    console.log("Utilisation du stockage Supabase pour:", path);
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(path);
      
    return publicUrl;
  } catch (error) {
    console.error("Erreur lors de la récupération de l'URL du fichier:", error);
    throw error;
  }
}
