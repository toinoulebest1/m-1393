import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, isDropboxEnabledForReading, uploadFileToDropbox, getDropboxSharedLink, checkFileExistsOnDropbox } from './dropboxStorage';
import { getPreGeneratedDropboxLink, generateAndSaveDropboxLinkAdvanced } from './dropboxLinkGenerator';
import { memoryCache } from './memoryCache';
import { getDropboxConfig } from './dropboxStorage';

export const uploadAudioFile = async (file: File, fileName: string): Promise<string> => {
  // Priorité stricte à Dropbox d'abord
  if (isDropboxEnabled()) {
    console.log('Using Dropbox for file upload');
    const dropboxPath = await uploadFileToDropbox(file, `audio/${fileName}`);
    
    // Générer immédiatement le lien partagé pour éviter les délais futurs
    try {
      const config = getDropboxConfig();
      if (config.accessToken) {
        console.log('🔗 Génération immédiate du lien partagé...');
        await generateAndSaveDropboxLinkAdvanced(fileName, dropboxPath, config.accessToken);
        console.log('✅ Lien partagé pré-généré avec succès');
      }
    } catch (error) {
      console.warn('⚠️ Échec génération lien partagé immédiat:', error);
      // Ne pas faire échouer l'upload, juste loguer l'erreur
    }
    
    return dropboxPath;
  }
  
  // Fallback vers Supabase (OneDrive complètement désactivé si Dropbox est configuré)
  console.log('Using Supabase for file upload');
  const { data, error } = await supabase.storage
    .from('audio')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }

  return data.path;
};

export const getAudioFileUrl = async (filePath: string): Promise<string> => {
  console.log('🔍 Récupération URL pour:', filePath);
  
  // 1. Vérifier le cache mémoire d'abord
  const cachedUrl = memoryCache.get(filePath);
  if (cachedUrl) {
    console.log('💾 Cache mémoire HIT:', filePath);
    return cachedUrl;
  }

  // 2. Vérifier s'il y a un lien pré-généré dans la base de données (pour Dropbox)
  if (isDropboxEnabledForReading()) {
    // Extraire l'ID du fichier (enlever les préfixes comme "audio/")
    const localId = filePath.includes('/') ? filePath.split('/').pop() : filePath;
    console.log('🔍 Recherche lien pré-généré pour ID:', localId);
    
    const preGeneratedLink = await getPreGeneratedDropboxLink(localId || filePath);
    if (preGeneratedLink) {
      console.log('⚡ Lien pré-généré trouvé:', preGeneratedLink);
      // Mettre en cache et retourner
      memoryCache.set(filePath, preGeneratedLink);
      return preGeneratedLink;
    }
    console.log('❌ Aucun lien pré-généré trouvé pour:', localId);
  }
  
  // 3. Priorité stricte à Dropbox d'abord (génération classique si pas de lien pré-généré)
  // Mais seulement si l'utilisateur a un token (admin)
  if (isDropboxEnabled()) {
    console.log('Using Dropbox for file retrieval with admin token');
    try {
      const exists = await checkFileExistsOnDropbox(filePath);
      if (!exists) {
        console.warn('⚠️ Fichier non trouvé sur Dropbox:', filePath);
        throw new Error('File not found on Dropbox');
      }
      
      const url = await getDropboxSharedLink(filePath);
      console.log('✅ URL Dropbox récupérée:', url);
      
      // Sauvegarder le lien pour la prochaine fois (en arrière-plan)
      const localId = filePath.includes('/') ? filePath.split('/').pop() : filePath;
      if (localId) {
        setTimeout(() => {
          generateAndSaveDropboxLinkAdvanced(localId, filePath, getDropboxConfig().accessToken).catch(err => 
            console.warn('⚠️ Erreur sauvegarde lien:', err)
          );
        }, 0);
      }
      
      // Mettre en cache et retourner
      memoryCache.set(filePath, url);
      return url;
    } catch (error) {
      console.error('❌ Erreur Dropbox pour', filePath, ':', error);
      // Si Dropbox est activé mais échoue, aller directement vers Supabase
      // Ne pas essayer OneDrive si Dropbox est configuré
    }
  }
  
  // 4. Fallback vers Supabase (OneDrive complètement ignoré si Dropbox est configuré)
  console.log('Using Supabase for file retrieval');
  try {
    const { data: listData, error: listError } = await supabase.storage
      .from('audio')
      .list('', {
        search: filePath
      });

    if (listError) {
      console.error('❌ Erreur liste Supabase:', listError);
      throw new Error(`Supabase list error: ${listError.message}`);
    }

    if (!listData || listData.length === 0) {
      console.warn('⚠️ Fichier non trouvé dans Supabase:', filePath);
      throw new Error(`File not found in Supabase storage: ${filePath}`);
    }

    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error('❌ Erreur création URL signée:', error);
      throw new Error(`Supabase signed URL error: ${error.message}`);
    }

    if (!data?.signedUrl) {
      console.error('❌ URL signée vide');
      throw new Error('Failed to get file URL from Supabase');
    }

    console.log('✅ URL Supabase récupérée');
    // Réactiver le cache mémoire pour les URL Supabase
    memoryCache.set(filePath, data.signedUrl);
    return data.signedUrl;
  } catch (error) {
    console.error('❌ Erreur complète récupération URL:', error);
    throw new Error(`Unable to retrieve file: ${filePath}. File may not exist in any storage system.`);
  }
};

// Legacy alias for backward compatibility
export const getAudioFile = getAudioFileUrl;
export const storeAudioFile = uploadAudioFile;

export const searchDeezerTrack = async (query: string): Promise<string | null> => {
  try {
    console.log(`Recherche Deezer pour: ${query}`);
    
    const { data, error } = await supabase.functions.invoke('deezer-search', {
      body: { query }
    });

    if (error) {
      console.error('Erreur recherche Deezer:', error);
      return null;
    }

    if (data && data.data && data.data.length > 0) {
      const track = data.data[0];
      const coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || track.album?.cover;
      
      console.log(`Pochette Deezer trouvée: ${coverUrl}`);
      return coverUrl;
    }

    console.log('Aucune pochette trouvée sur Deezer');
    return null;
  } catch (error) {
    console.error('Erreur lors de la recherche Deezer:', error);
    return null;
  }
};

export const storePlaylistCover = async (playlistId: string, coverDataUrl: string): Promise<string> => {
  // Convert data URL to File
  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const coverFile = dataURLtoFile(coverDataUrl, `playlist-${playlistId}-cover.jpg`);
  const fileName = `playlist-covers/${playlistId}.jpg`;
  
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(fileName, coverFile, {
      upsert: true,
      contentType: 'image/jpeg'
    });
  
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage
    .from('media')
    .getPublicUrl(fileName);
  
  return publicUrl;
};

export const generateImageFromSongs = async (songs: any[]): Promise<string> => {
  // Placeholder - implement image generation from songs
  console.warn('generateImageFromSongs not implemented yet');
  return '';
};
