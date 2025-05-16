
import { supabase } from '@/integrations/supabase/client';

// Improved function to retrieve an audio file, with better error handling and logging
export async function getAudioFileUrl(path: string): Promise<string> {
  if (!path) {
    throw new Error("Chemin du fichier non fourni");
  }

  try {
    console.log(`Tentative de récupération du fichier audio: ${path}`);
    
    // First check if this is a Dropbox file reference
    const { data: fileRef } = await supabase
      .from('dropbox_files')
      .select('storage_provider, dropbox_path')
      .eq('local_id', path)
      .maybeSingle();
      
    // If it's a file stored in Supabase but referenced as Dropbox
    if (fileRef?.storage_provider === 'supabase') {
      const fileName = fileRef.dropbox_path.split('/').pop();
      console.log(`Fichier référencé comme Dropbox mais stocké sur Supabase: ${fileName}`);
      
      const { data } = supabase.storage
        .from('audio')
        .getPublicUrl(fileName || path);
        
      console.log(`URL publique générée: ${data.publicUrl.substring(0, 50)}...`);
      return data.publicUrl;
    }
    
    // If it's a file stored on Dropbox
    if (fileRef?.storage_provider === 'dropbox' || fileRef?.dropbox_path) {
      try {
        console.log(`Tentative de récupération depuis Dropbox: ${fileRef?.dropbox_path || path}`);
        
        // Try to get a direct download link from Dropbox using our edge function
        const { data, error } = await supabase.functions.invoke('dropbox-storage', {
          method: 'POST',
          body: {
            action: 'get',
            path: fileRef?.dropbox_path || path
          }
        });
        
        if (error) {
          console.error("Erreur avec l'edge function Dropbox:", error);
          throw error;
        }
        
        if (!data?.url) {
          console.error("URL Dropbox non disponible dans la réponse");
          throw new Error("URL Dropbox non disponible");
        }
        
        console.log(`URL Dropbox récupérée: ${data.url.substring(0, 50)}...`);
        return data.url;
      } catch (dropboxError) {
        console.warn("Échec de la récupération depuis Dropbox, tentative avec Supabase:", dropboxError);
        // Fall through to try Supabase instead
      }
    }
    
    // Direct Supabase Storage approach
    console.log(`Tentative de récupération directe depuis Supabase Storage: ${path}`);
    const fileName = path.includes('/') ? path.split('/').pop() : path;
    
    // Try first with a public URL which works better for most browsers
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName || path);
      
    console.log(`URL publique Supabase générée: ${publicUrl.substring(0, 50)}...`);
    return publicUrl;
  } catch (error) {
    console.error("Erreur détaillée lors de la récupération de l'URL du fichier:", error);
    throw new Error(`Erreur lors de la récupération de l'URL du fichier: ${error.message || 'Erreur inconnue'}`);
  }
}
