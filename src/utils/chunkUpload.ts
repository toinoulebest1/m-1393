
import { supabase } from '@/integrations/supabase/client';

interface ChunkUploadOptions {
  chunkSize?: number;
  onProgress?: (progress: number) => void;
}

export const uploadFileInChunks = async (
  file: File,
  path: string,
  options: ChunkUploadOptions = {}
): Promise<string> => {
  const { chunkSize = 1024 * 1024, onProgress } = options; // 1MB par chunk par défaut
  
  // Si le fichier est petit, upload direct
  if (file.size <= chunkSize) {
    console.log(`📁 Upload direct (petit fichier): ${file.name}`);
    
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'audio/mpeg'
      });

    if (error) throw error;
    onProgress?.(100);
    return data.path;
  }

  console.log(`🔄 Upload par chunks: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  
  // Pour les gros fichiers, on fait quand même un upload direct avec Supabase
  // car le chunking simulé ne résout pas le problème de MIME type
  console.log(`📤 Upload direct optimisé pour gros fichier: ${file.name}`);
  
  const { data, error } = await supabase.storage
    .from('audio')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'audio/mpeg'
    });

  if (error) throw error;
  onProgress?.(100);
  return data.path;
};
