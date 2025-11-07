import { supabase } from '@/integrations/supabase/client';
import { isDropboxEnabled, isDropboxEnabledForReading, uploadFileToDropbox, getDropboxSharedLink, checkFileExistsOnDropbox } from './dropboxStorage';
import { getPreGeneratedDropboxLink, generateAndSaveDropboxLinkAdvanced } from './dropboxLinkGenerator';
import { memoryCache } from './memoryCache';
import { getDropboxConfig } from './dropboxStorage';
import { circuitBreaker } from './circuitBreaker';
import { audioProxyService } from '@/services/audioProxyService';
import { tidalSearchService } from '@/services/tidalSearchService';

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


// Recherche l'ID Deezer à partir d'un ISRC
export const searchDeezerIdFromIsrc = async (isrc: string): Promise<string | null> => {
  try {
    console.log('🔍 Recherche Deezer ID via ISRC:', isrc);
    
    const { data, error } = await supabase.functions.invoke('deezer-proxy', {
      body: { 
        endpoint: `/2.0/track/isrc:${isrc}`
      }
    });
    
    if (error) {
      console.warn('⚠️ Deezer proxy error (ISRC):', error);
      return null;
    }
    
    if (data?.id) {
      console.log('✅ Deezer ID trouvé via ISRC:', data.id);
      return String(data.id);
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ Erreur recherche Deezer par ISRC:', error);
    return null;
  }
};

// Recherche l'ID Deezer directement par titre/artiste
export const searchDeezerIdByTitleArtist = async (title: string, artist: string): Promise<string | null> => {
  try {
    console.log('🔍 Recherche Deezer ID par titre:', title, '- Artiste attendu:', artist);
    
    const { data, error } = await supabase.functions.invoke('deezer-proxy', {
      body: { 
        endpoint: '/search/track',
        query: title,
        limit: 20
      }
    });
    
    if (error) {
      console.warn('⚠️ Deezer proxy error (search):', error);
      return null;
    }
    
    if (data?.data && data.data.length > 0) {
      // Normaliser les noms pour la comparaison
      const normalizeArtist = (name: string) => 
        name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      
      const normalizedSearchArtist = normalizeArtist(artist);
      
      // Trouver la meilleure correspondance avec l'artiste
      for (const track of data.data) {
        const trackArtistName = track.artist?.name || '';
        const normalizedTrackArtist = normalizeArtist(trackArtistName);
        
        // Correspondance exacte ou partielle
        if (normalizedTrackArtist.includes(normalizedSearchArtist) || 
            normalizedSearchArtist.includes(normalizedTrackArtist)) {
          console.log('✅ Deezer ID trouvé avec correspondance artiste:', track.id, '-', trackArtistName);
          return String(track.id);
        }
      }
      
      // Si aucune correspondance exacte, prendre le premier résultat
      const track = data.data[0];
      console.log('⚠️ Aucune correspondance artiste, premier résultat utilisé:', track.id, '-', track.artist?.name);
      return String(track.id);
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ Erreur recherche Deezer par titre/artiste:', error);
    return null;
  }
};


export const getAudioFileUrl = async (filePath: string, deezerId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<{ url: string; duration?: number }> => {
  const FORCE_DEEZMATE_FLAC = true;
  console.log('🔍 Récupération URL pour:', filePath, 'Deezer ID:', deezerId, 'Song ID:', songId);

  // ========== STRATÉGIE FORCÉE: DEEZMATE/FLAC UNIQUEMENT ==========
  if (FORCE_DEEZMATE_FLAC) {
    console.log("🎯 Source forcée: Deezmate (FLAC). La preview (filePath) sera ignorée si un ID Deezer est trouvé.");

    let finalDeezerId = deezerId;

    // ÉTAPE 1: Assurer d'avoir un ID Deezer
    if (!finalDeezerId && songId && !songId.startsWith('deezer-')) {
      try {
        const { data: songData } = await supabase.from('songs').select('deezer_id').eq('id', songId).single();
        if (songData?.deezer_id) {
          console.log('🔥 ID Deezer trouvé dans la DB:', songData.deezer_id);
          finalDeezerId = songData.deezer_id;
        }
      } catch (error) {
        console.warn('⚠️ Erreur recherche deezer_id dans DB:', error);
      }
    }

    if (!finalDeezerId && songTitle && songArtist) {
      try {
        const foundId = await searchDeezerIdByTitleArtist(songTitle, songArtist);
        if (foundId) {
          console.log('🔥 ID Deezer trouvé par recherche:', foundId);
          finalDeezerId = foundId;
        }
      } catch (error) {
        console.warn('⚠️ Erreur recherche deezer_id par titre/artiste:', error);
      }
    }
    
    if (!finalDeezerId && songId && songId.startsWith('deezer-')) {
        finalDeezerId = songId.replace('deezer-', '');
        console.log('🔥 ID Deezer extrait du songId:', finalDeezerId);
    }

    // ÉTAPE 2: Utiliser l'ID Deezer si disponible
    if (finalDeezerId) {
      console.log(`🚀 Tentative Deezmate avec ID: ${finalDeezerId}`);
      try {
        const result = await audioProxyService.getAudioUrl(finalDeezerId, 'FLAC');
        if (result && result.url && (result.url.startsWith('http') || result.url.startsWith('blob:'))) {
          console.log('✅ [FORCED] URL audio Deezmate récupérée:', result.url.substring(0, 50) + '...');
          
          if (songId && !deezerId) {
            void supabase.from('songs').update({ deezer_id: finalDeezerId }).eq('id', songId);
          }
          
          return result;
        }
        throw new Error("Le service audio n'a pas retourné d'URL valide.");
      } catch (error) {
        console.error("❌ [FORCED] Erreur service audio:", error);
        throw new Error("La source Deezmate (forcée) a échoué. Impossible de lire la musique.");
      }
    }
  }

  // ========== FALLBACK: STORAGE LOCAL (HORS DEEZER) ==========
  console.log('⚠️ Fallback vers le stockage local (Supabase/Dropbox).');
  
  if (filePath && (filePath.includes('dzcdn.net') || filePath.startsWith('deezer:'))) {
      throw new Error("La source Deezmate a échoué et les previews sont désactivées. Impossible de lire la musique.");
  }

  try {
    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error('❌ Erreur Supabase Storage:', error);
      throw new Error(`Impossible de récupérer le fichier. Essayez de le chercher sur Deezer via la recherche.`);
    }

    if (!data?.signedUrl) {
      throw new Error('Fichier introuvable. Utilisez la recherche Deezer pour trouver cette musique.');
    }

    console.log('✅ URL Supabase récupérée (fichier local)');
    return { url: data.signedUrl };
  } catch (error) {
    console.error('❌ Musique introuvable:', error);
    throw new Error(`Cette musique n'est pas disponible. Utilisez la recherche Deezer pour la trouver.`);
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