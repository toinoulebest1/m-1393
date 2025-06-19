
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
  
  const totalChunks = Math.ceil(file.size / chunkSize);
  let uploadedBytes = 0;

  // Créer un multipart upload
  const uploadId = crypto.randomUUID();
  const parts: any[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    console.log(`📤 Upload chunk ${i + 1}/${totalChunks} (${(chunk.size / 1024).toFixed(1)}KB)`);
    
    try {
      // Upload de chaque chunk
      const chunkPath = `${path}_chunk_${i}`;
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(chunkPath, chunk, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;
      
      parts.push({
        ETag: data.path,
        PartNumber: i + 1
      });

      uploadedBytes += chunk.size;
      const progress = (uploadedBytes / file.size) * 100;
      onProgress?.(progress);
      
    } catch (error) {
      console.error(`❌ Erreur chunk ${i + 1}:`, error);
      throw error;
    }
  }

  // Assembler les chunks (simulation - en réalité on ferait un upload direct pour Supabase)
  console.log(`🔧 Assemblage des chunks pour: ${file.name}`);
  
  // Pour Supabase, on fait finalement un upload direct du fichier complet
  // car il ne supporte pas nativement le multipart upload comme AWS S3
  const { data, error } = await supabase.storage
    .from('audio')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'audio/mpeg'
    });

  if (error) throw error;

  // Nettoyer les chunks temporaires
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = `${path}_chunk_${i}`;
    await supabase.storage.from('audio').remove([chunkPath]);
  }

  onProgress?.(100);
  return data.path;
};
