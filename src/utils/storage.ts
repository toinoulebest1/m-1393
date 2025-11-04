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


export const getAudioFileUrl = async (filePath: string, deezerId?: string, songTitle?: string, songArtist?: string, songId?: string): Promise<string> => {
  console.log('🔍 Récupération URL pour:', filePath, 'Deezer ID:', deezerId, 'Song ID:', songId);

  // ========== PRIORITÉ ABSOLUE: DEEZER/DEEZMATE ==========
  
  // ÉTAPE 0: Si on a un songId mais pas de deezerId, chercher dans la DB
  if (songId && !deezerId) {
    try {
      const { data: songData } = await supabase
        .from('songs')
        .select('deezer_id')
        .eq('id', songId)
        .single();
      
      if (songData?.deezer_id) {
        console.log('🔥 ID Deezer trouvé dans la DB:', songData.deezer_id);
        deezerId = songData.deezer_id;
      }
    } catch (error) {
      console.warn('⚠️ Erreur recherche deezer_id:', error);
    }
  }

  // ÉTAPE 1: API Deezmate si un deezerId est fourni
  if (deezerId) {
    console.log('🎵 Essai API Deezmate avec ID:', deezerId);
    try {
      const url = `https://api.deezmate.com/dl/${deezerId}`;
      console.log('📡 Appel Deezmate:', url);
      const res = await fetch(url);
      
      if (res.ok) {
        const data = await res.json();
        const flacUrl = data?.links?.flac || data?.links?.FLAC;
        
        if (flacUrl && typeof flacUrl === 'string' && flacUrl.startsWith('http')) {
          console.log('✅ Deezmate URL FLAC obtenue, vérification...:', flacUrl);
          
          // Vérifier que l'URL Deezmate fonctionne vraiment
          try {
            const testRes = await fetch(flacUrl, { method: 'HEAD' });
            if (testRes.ok) {
              console.log('✅ URL Deezmate validée');
              
              // Sauvegarder l'ID Deezer dans la table songs si on a un songId
              if (songId) {
                void supabase.from('songs').update({ deezer_id: deezerId }).eq('id', songId);
              }
              
              return flacUrl;
            } else {
              console.warn('⚠️ URL Deezmate invalide (HTTP', testRes.status, '), passage au fallback');
            }
          } catch (testError) {
            console.warn('⚠️ Test URL Deezmate échoué:', testError);
          }
        } else {
          console.warn('⚠️ Deezmate réponse invalide (pas de FLAC):', data);
        }
      } else {
        console.warn('⚠️ Deezmate API error:', res.status);
      }
    } catch (error) {
      console.warn('⚠️ Deezmate API échec:', error);
    }

    // FALLBACK: API flacdownloader.com si Deezmate échoue
    console.log('🎵 Essai API flacdownloader.com avec ID:', deezerId);
    try {
      const shareLink = `https://www.deezer.com/track/${deezerId}`;
      const flacUrl = `https://flacdownloader.com/flac/download?t=${encodeURIComponent(shareLink)}&f=FLAC`;
      console.log('📡 Appel flacdownloader:', flacUrl);
      
      // Vérifier que l'URL est accessible
      const testRes = await fetch(flacUrl, { method: 'HEAD' });
      if (testRes.ok) {
        console.log('✅ flacdownloader URL FLAC obtenue:', flacUrl);
        
        // Sauvegarder l'ID Deezer dans la table songs si on a un songId
        if (songId) {
          void supabase.from('songs').update({ deezer_id: deezerId }).eq('id', songId);
        }
        
        return flacUrl;
      } else {
        console.warn('⚠️ flacdownloader API error:', testRes.status);
      }
    } catch (error) {
      console.warn('⚠️ flacdownloader API échec:', error);
    }
  }

  // ÉTAPE 3: Si pas de deezerId mais on a titre+artiste, recherche parallélisée
  if (!deezerId && songTitle && songArtist) {
    console.log('🔎 Recherche parallèle Deezer ID...');
    
    try {
      // Recherche directe Deezer ID
      const foundDeezerId = await searchDeezerIdByTitleArtist(songTitle, songArtist).catch(() => null);
      
      // Si on a trouvé un ID Deezer, essayer Deezmate
      if (foundDeezerId) {
        console.log('🎵 ID Deezer trouvé:', foundDeezerId);
        
        // Appel Deezmate direct (pas de cache car expire en 1 min)
        try {
          const url = `https://api.deezmate.com/dl/${foundDeezerId}`;
          console.log('📡 Appel Deezmate:', url);
          const res = await fetch(url);
          
          if (res.ok) {
            const data = await res.json();
            const flacUrl = data?.links?.flac || data?.links?.FLAC;
            
            if (flacUrl && typeof flacUrl === 'string' && flacUrl.startsWith('http')) {
              console.log('✅ Deezmate URL FLAC obtenue, vérification...:', flacUrl);
              
              // Vérifier que l'URL Deezmate fonctionne vraiment
              try {
                const testRes = await fetch(flacUrl, { method: 'HEAD' });
                if (testRes.ok) {
                  console.log('✅ URL Deezmate validée');
                  
                  // Sauvegarder l'ID Deezer dans la table songs si on a un songId
                  if (songId) {
                    void supabase.from('songs').update({ deezer_id: foundDeezerId }).eq('id', songId);
                  }
                  
                  return flacUrl;
                } else {
                  console.warn('⚠️ URL Deezmate invalide (HTTP', testRes.status, '), passage au fallback');
                }
              } catch (testError) {
                console.warn('⚠️ Test URL Deezmate échoué:', testError);
              }
            } else {
              console.warn('⚠️ Deezmate réponse invalide (pas de FLAC):', data);
            }
          } else {
            console.warn('⚠️ Deezmate API error:', res.status);
          }
        } catch (error) {
          console.warn('⚠️ Deezmate échec:', error);
        }

        // FALLBACK: API flacdownloader.com si Deezmate échoue
        console.log('🎵 Essai API flacdownloader.com avec ID:', foundDeezerId);
        try {
          const shareLink = `https://www.deezer.com/track/${foundDeezerId}`;
          const flacUrl = `https://flacdownloader.com/flac/download?t=${encodeURIComponent(shareLink)}&f=FLAC`;
          console.log('📡 Appel flacdownloader:', flacUrl);
          
          // Vérifier que l'URL est accessible
          const testRes = await fetch(flacUrl, { method: 'HEAD' });
          if (testRes.ok) {
            console.log('✅ flacdownloader URL FLAC obtenue:', flacUrl);
            
            // Sauvegarder l'ID Deezer dans la table songs si on a un songId
            if (songId) {
              void supabase.from('songs').update({ deezer_id: foundDeezerId }).eq('id', songId);
            }
            
            return flacUrl;
          } else {
            console.warn('⚠️ flacdownloader API error:', testRes.status);
          }
        } catch (error) {
          console.warn('⚠️ flacdownloader API échec:', error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Erreur recherche Deezer:', error);
    }
  }

  // ========== FALLBACK: STORAGE LOCAL UNIQUEMENT ==========
  // Si pas de deezerId trouvé, on passe directement au storage local (Supabase)
  
  console.log('⚠️ Aucun lien Deezmate disponible, fallback vers storage local...');
  
  // Extraire l'ID du fichier (enlever les préfixes comme "audio/")
  const localId = filePath.includes('/') ? filePath.split('/').pop() : filePath;
  
  console.log('📦 Tentative récupération depuis Supabase Storage. localId:', localId);
  
  // Fallback final: Supabase Storage pour fichiers uploadés
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
    return data.signedUrl;
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
