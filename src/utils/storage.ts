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

// Fonction pour chercher automatiquement un titre sur Tidal
export const searchTidalId = async (title: string, artist: string): Promise<string | null> => {
  try {
    const query = `${artist} ${title}`.trim();
    const searchUrl = `https://phoenix.squid.wtf/search/?s=${encodeURIComponent(query)}`;
    console.log('🔎 Recherche Tidal automatique:', searchUrl);
    
    const res = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.warn('⚠️ Échec recherche Tidal:', res.status);
      return null;
    }
    
    const data = await res.json();
    const results = data?.tracks || data?.results || [];
    
    if (!results || results.length === 0) {
      console.warn('⚠️ Aucun résultat Tidal trouvé pour:', query);
      return null;
    }
    
    // Trouver le meilleur résultat : même artiste + meilleure popularité
    const normalizedArtist = artist.toLowerCase().trim();
    let bestMatch = null;
    let bestPopularity = -1;
    
    for (const track of results) {
      const trackArtist = (track.artist?.name || track.artists?.[0]?.name || '').toLowerCase().trim();
      const popularity = track.popularity || 0;
      
      // Vérifier si l'artiste correspond
      if (trackArtist.includes(normalizedArtist) || normalizedArtist.includes(trackArtist)) {
        if (popularity > bestPopularity) {
          bestMatch = track;
          bestPopularity = popularity;
        }
      }
    }
    
    // Si pas de correspondance exacte, prendre le premier résultat avec la meilleure popularité
    if (!bestMatch && results.length > 0) {
      bestMatch = results.reduce((best: any, current: any) => {
        const currentPop = current.popularity || 0;
        const bestPop = best.popularity || 0;
        return currentPop > bestPop ? current : best;
      }, results[0]);
    }
    
    if (bestMatch?.id) {
      console.log('✅ Tidal ID trouvé:', bestMatch.id, 'pour', query);
      
      // Sauvegarder automatiquement le tidal_id dans la DB si possible
      try {
        const { data: songs } = await supabase
          .from('songs')
          .select('id')
          .ilike('title', title)
          .ilike('artist', artist)
          .limit(1);
          
        if (songs && songs.length > 0) {
          await supabase
            .from('songs')
            .update({ tidal_id: bestMatch.id.toString() })
            .eq('id', songs[0].id);
          console.log('💾 Tidal ID sauvegardé dans la DB');
        }
      } catch (e) {
        console.warn('⚠️ Impossible de sauvegarder le tidal_id:', e);
      }
      
      return bestMatch.id.toString();
    }
    
    console.warn('⚠️ Aucun ID Tidal trouvé dans les résultats');
    return null;
  } catch (error) {
    console.error('❌ Erreur recherche Tidal:', error);
    return null;
  }
};

export const getAudioFileUrl = async (filePath: string, tidalId?: string, songTitle?: string, songArtist?: string): Promise<string> => {
  console.log('🔍 Récupération URL pour:', filePath, 'Tidal ID:', tidalId);

  // Helper: Phoenix/Tidal fetch → OriginalTrackUrl
  const fetchPhoenixUrl = async (tid: string): Promise<string> => {
    const api = `https://phoenix.squid.wtf/track/?id=${tid}&quality=LOSSLESS`;
    console.log('🎵 Phoenix API:', api);
    const res = await fetch(api, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Phoenix API error: ${res.status}`);

    let data: any;
    try {
      data = await res.json();
    } catch (e) {
      const text = await res.text();
      console.warn('⚠️ Phoenix non-JSON réponse:', text.slice(0, 200));
      throw new Error('Phoenix a renvoyé une réponse inattendue');
    }

    const direct = data?.OriginalTrackUrl || data?.originalTrackUrl || data?.original_url || data?.url;
    if (!direct || typeof direct !== 'string') {
      console.error('❌ Phoenix JSON sans OriginalTrackUrl:', data);
      throw new Error('OriginalTrackUrl introuvable dans la réponse Phoenix');
    }
    console.log('✅ Phoenix OriginalTrackUrl:', direct);
    return direct;
  };
  
  // 0. Phoenix prioritaire si un tidal_id est fourni
  if (tidalId) {
    const direct = await fetchPhoenixUrl(tidalId);
    memoryCache.set(filePath, direct);
    return direct;
  }
  
  // 0-auto. Si pas de tidal_id mais on a titre + artiste, chercher automatiquement
  if (!tidalId && songTitle && songArtist) {
    console.log('🔍 Pas de Tidal ID, recherche automatique pour:', songTitle, '-', songArtist);
    const foundTidalId = await searchTidalId(songTitle, songArtist);
    if (foundTidalId) {
      const direct = await fetchPhoenixUrl(foundTidalId);
      memoryCache.set(filePath, direct);
      return direct;
    }
    console.warn('⚠️ Recherche Tidal automatique échouée, fallback vers Supabase');
  }

  // 0-bis. Si l'URL est déjà un lien Phoenix, extraire l'id et récupérer l'URL directe
  try {
    if (filePath.includes('phoenix.squid.wtf/track')) {
      const urlObj = new URL(filePath);
      const maybeId = urlObj.searchParams.get('id');
      if (maybeId) {
        const direct = await fetchPhoenixUrl(maybeId);
        memoryCache.set(filePath, direct);
        return direct;
      }
    }
  } catch (_) {}

  // 0-ter. Si le chemin commence par "tidal:{id}", utiliser Phoenix
  if (filePath.startsWith('tidal:')) {
    const extractedTidalId = filePath.replace('tidal:', '');
    const direct = await fetchPhoenixUrl(extractedTidalId);
    memoryCache.set(filePath, direct);
    return direct;
  }

  // 1. Vérifier le cache mémoire d'abord
  const cachedUrl = memoryCache.get(filePath);
  if (cachedUrl) {
    console.log('💾 Cache mémoire HIT:', filePath);
    return cachedUrl;
  }

  // 2. Extraire l'ID du fichier (enlever les préfixes comme "audio/")
  const localId = filePath.includes('/') ? filePath.split('/').pop() : filePath;
  
  console.log('🔍 Recherche lien Dropbox désactivé. localId:', localId);
  
  // 4. Fallback vers Supabase Storage
  console.log('📦 Fallback Supabase Storage');
  try {
    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error('❌ Erreur Supabase Storage:', error);
      throw new Error(`Supabase signed URL error: ${error.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error('Failed to get file URL from Supabase');
    }

    console.log('✅ URL Supabase récupérée');
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
