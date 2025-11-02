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

// Fonction pour chercher automatiquement un titre sur Tidal avec plusieurs tentatives (SIMULTANÉ)
// Lance toutes les recherches en parallèle et retourne dès qu'un résultat valide est trouvé
export const searchTidalIds = async (title: any, artist: any, maxResults: number = 3): Promise<string[]> => {
  const safeTitle = String(title ?? '').trim();
  const safeArtist = String(artist ?? '').trim();
  
  const searchQueries = [
    `${safeTitle}, ${safeArtist}`.trim(),
    `${safeTitle} ${safeArtist}`.trim(),
  ].filter(q => q.length > 0);
  
  console.log('🚀 Recherche Tidal SIMULTANÉE avec', searchQueries.length, 'combinaisons');
  
  const normalize = (s: any) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const simplifyTitle = (s: any) => normalize(s).split(/\s*-\s*|\(|\[|\{/)[0];
  const expectedArtist = normalize(safeArtist);
  const expectedTitle = simplifyTitle(safeTitle);
  const aliases = new Set<string>([
    expectedArtist,
    expectedArtist.replace(/^maitre\s+/,'').trim(),
    expectedArtist.replace('gims','maitre gims').trim(),
  ]);

  const apis = [
    'https://katze.qqdl.site/search/',
    'https://frankfurt.monochrome.tf/search/',
    'https://phoenix.squid.wtf/search/'
  ];

  const extractTidalId = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.tidalId) return String(obj.tidalId);
    if (obj.tidal_id) return String(obj.tidal_id);
    if (obj.tidal?.id) return String(obj.tidal.id);
    const provider = (obj.service || obj.provider || obj.platform || obj.source || '').toString().toLowerCase();
    if (provider === 'tidal') {
      const direct = obj.id ?? obj.trackId ?? null;
      if (direct) return String(direct);
    }
    const link = obj.url || obj.link || obj.permalink || obj.webUrl || obj.web_url || '';
    if (typeof link === 'string') {
      const m1 = link.match(/tidal\.com\/.*track\/(\d+)/i);
      if (m1?.[1]) return m1[1];
      const m2 = link.match(/[?&]trackId=(\d+)/i);
      if (m2?.[1]) return m2[1];
    }
    if (obj.data && typeof obj.data === 'object') {
      const nested = extractTidalId(obj.data);
      if (nested) return nested;
    }
    return null;
  };

  const scoreTrack = (track: any): { id: string; score: number } | null => {
    const candId = extractTidalId(track);
    if (!candId) return null;

    const rawTitle = String(track.title || track.name || track.trackName || '').toLowerCase();
    const candTitle = simplifyTitle(rawTitle);
    const artistsList: string[] = [];
    if (track.artist?.name) artistsList.push(track.artist.name);
    if (Array.isArray(track.artists)) artistsList.push(...track.artists.map((a: any) => a?.name).filter(Boolean));
    if (track.artist_name) artistsList.push(track.artist_name);
    if (track.artist) artistsList.push(track.artist);
    const candArtists = artistsList.map(normalize).filter(Boolean);

    const hasExactArtist = candArtists.some((a: string) => aliases.has(a));
    const hasPartialArtist = candArtists.some((a: string) => a.includes(expectedArtist) || expectedArtist.includes(a));
    const titleExact = candTitle === expectedTitle;
    const titleStarts = candTitle.startsWith(expectedTitle);
    const titleIncludes = candTitle.includes(expectedTitle);
    const hasUnwantedWords = /remix|version|feat|ft\.|featuring|edit|radio|extended|acoustic|live|cover|instrumental/i.test(rawTitle);

    let score = 0;
    if (hasExactArtist) score += 100; else if (hasPartialArtist) score += 50;
    if (titleExact) score += 200; else if (titleStarts) score += 50; else if (titleIncludes) score += 20;
    const popularity = track.popularity || track.popularityScore || 0;
    score += Math.min(5, Math.floor(popularity / 20));
    if (hasUnwantedWords) score -= 100;

    return { id: candId, score };
  };

  // Fonction pour rechercher sur toutes les APIs en parallèle
  const searchAll = async (query: string) => {
    const apis = [
      `https://katze.qqdl.site/search/?s=${encodeURIComponent(query)}`,
      `https://frankfurt.monochrome.tf/search/?s=${encodeURIComponent(query)}`,
      `https://phoenix.squid.wtf/search/?s=${encodeURIComponent(query)}`
    ];

    try {
      const results = await Promise.allSettled(
        apis.map(url => 
          fetch(url, { 
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000)
          }).then(res => res.ok ? res.json() : null)
        )
      );

      const allTracks: any[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const data = result.value;
          let tracks = [];
          if (Array.isArray(data)) tracks = data;
          else if (data?.tracks) tracks = data.tracks;
          else if (data?.results) tracks = data.results;
          else if (data?.data) tracks = data.data;
          else if (data?.items) tracks = data.items;
          allTracks.push(...tracks);
        }
      }

      return allTracks.slice(0, 30); // Limiter pour performance
    } catch (error) {
      console.error('❌ Erreur recherche:', error);
      return [];
    }
  };

  // Lancer TOUTES les recherches en parallèle
  const allSearchPromises = searchQueries.map(query => searchAll(query));
  const allResults = await Promise.all(allSearchPromises);

  // Combiner et scorer tous les résultats
  const allTracks = allResults.flat();
  const scoredResults = allTracks
    .map(scoreTrack)
    .filter((r): r is { id: string; score: number } => r !== null)
    .sort((a, b) => b.score - a.score);

  // Retourner les meilleurs résultats uniques
  const foundIds: string[] = [];
  for (const result of scoredResults) {
    if (!foundIds.includes(result.id)) {
      foundIds.push(result.id);
      console.log(`✅ Tidal ID #${foundIds.length}:`, result.id, 'score:', result.score);
      if (foundIds.length >= maxResults) break;
    }
  }
  
  console.log(`📋 Total: ${foundIds.length} IDs`, foundIds);
  return foundIds;
};

// Version simple qui retourne juste le premier ID (pour compatibilité)
export const searchTidalId = async (title: any, artist: any): Promise<string | null> => {
  const ids = await searchTidalIds(title, artist, 1);
  return ids.length > 0 ? ids[0] : null;
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

// Récupère l'URL audio depuis un Tidal ID
export const getTidalAudioUrl = async (tidalId: string): Promise<string | null> => {
  try {
    console.log('🎵 [TIDAL] Récupération URL audio pour ID:', tidalId);
    
    const apis = [
      `https://katze.qqdl.site/track/?id=${tidalId}&quality=LOSSLESS`,
      `https://frankfurt.monochrome.tf/track/?id=${tidalId}&quality=LOSSLESS`,
      `https://phoenix.squid.wtf/track/?id=${tidalId}&quality=LOSSLESS`
    ];

    for (const url of apis) {
      try {
        console.log('📡 [TIDAL] Tentative:', url);
        const res = await fetch(url, { 
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000)
        });
        
        console.log('📥 [TIDAL] Status:', res.status, 'pour', url);
        
        if (!res.ok) {
          console.warn('⚠️ [TIDAL] HTTP error:', res.status);
          continue;
        }
        
        const contentType = res.headers.get('content-type');
        console.log('📄 [TIDAL] Content-Type:', contentType);
        
        // Si c'est un fichier audio direct (pas JSON)
        if (contentType?.includes('audio') || contentType?.includes('octet-stream')) {
          console.log('✅ [TIDAL] URL audio directe obtenue:', url);
          return url; // L'URL elle-même est l'audio
        }
        
        // Sinon, parser le JSON
        const data = await res.json();
        console.log('📦 [TIDAL] Réponse JSON:', data);
        
        // L'API Tidal retourne un tableau avec l'URL dans le 3ème objet
        if (Array.isArray(data) && data[2]?.OriginalTrackUrl) {
          const audioUrl = data[2].OriginalTrackUrl;
          console.log('✅ [TIDAL] URL audio trouvée dans OriginalTrackUrl:', audioUrl);
          return audioUrl;
        }
        
        // Extraire l'URL audio de différentes structures possibles (fallback)
        const audioUrl = data?.url || data?.audioUrl || data?.streamUrl || data?.link || data?.downloadUrl || data?.file;
        
        if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
          console.log('✅ [TIDAL] URL audio obtenue:', audioUrl);
          return audioUrl;
        }
        
        // Parfois l'URL est dans un objet "data"
        if (data?.data?.url) {
          console.log('✅ [TIDAL] URL audio obtenue (nested):', data.data.url);
          return data.data.url;
        }
        
        console.warn('⚠️ [TIDAL] Aucune URL audio trouvée dans la réponse');
      } catch (error) {
        console.warn('⚠️ [TIDAL] Erreur API:', url, error);
      }
    }
    
    console.warn('❌ [TIDAL] Toutes les APIs ont échoué');
    return null;
  } catch (error) {
    console.warn('❌ [TIDAL] Erreur récupération URL:', error);
    return null;
  }
};

// Recherche l'ISRC d'un track Tidal
export const searchTidalIsrc = async (title: string, artist: string): Promise<string | null> => {
  try {
    const query = `${title}, ${artist}`;
    const apis = [
      `https://katze.qqdl.site/search/?s=${encodeURIComponent(query)}`,
      `https://frankfurt.monochrome.tf/search/?s=${encodeURIComponent(query)}`,
      `https://phoenix.squid.wtf/search/?s=${encodeURIComponent(query)}`
    ];

    for (const url of apis) {
      try {
        const res = await fetch(url, { 
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        
        if (!res.ok) continue;
        
        const data = await res.json();
        let tracks = [];
        
        if (Array.isArray(data)) tracks = data;
        else if (data?.items) tracks = data.items;
        else if (data?.tracks) tracks = data.tracks;
        
        // Prendre le premier résultat qui a un ISRC
        for (const track of tracks.slice(0, 3)) {
          if (track?.isrc) {
            console.log('✅ ISRC trouvé:', track.isrc, 'pour', title);
            return track.isrc;
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur API:', url, error);
      }
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ Erreur recherche ISRC:', error);
    return null;
  }
};

export const getAudioFileUrl = async (filePath: string, deezerId?: string, songTitle?: string, songArtist?: string, tidalId?: string, songId?: string): Promise<string> => {
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
          console.log('✅ Deezmate URL FLAC obtenue:', flacUrl);
          
          // Sauvegarder l'ID Deezer dans la table songs si on a un songId
          if (songId) {
            void supabase.from('songs').update({ deezer_id: deezerId }).eq('id', songId);
          }
          
          return flacUrl;
        } else {
          console.warn('⚠️ Deezmate réponse invalide (pas de FLAC):', data);
        }
      } else {
        console.warn('⚠️ Deezmate API error:', res.status);
      }
    } catch (error) {
      console.warn('⚠️ Deezmate API échec:', error);
    }
  }

  // ÉTAPE 3: Si pas de deezerId mais on a titre+artiste, recherche parallélisée
  if (!deezerId && songTitle && songArtist) {
    console.log('🔎 Recherche parallèle Deezer ID...');
    
    try {
      // Lancer les deux recherches en parallèle
      const [deezerIdDirect, isrcResult] = await Promise.all([
        searchDeezerIdByTitleArtist(songTitle, songArtist).catch(() => null),
        searchTidalIsrc(songTitle, songArtist).catch(() => null)
      ]);
      
      let foundDeezerId = deezerIdDirect;
      
      // Si pas trouvé directement mais on a un ISRC, chercher via ISRC
      if (!foundDeezerId && isrcResult) {
        foundDeezerId = await searchDeezerIdFromIsrc(isrcResult).catch(() => null);
      }
      
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
              console.log('✅ Deezmate URL FLAC obtenue:', flacUrl);
              
              // Sauvegarder l'ID Deezer dans la table songs si on a un songId
              if (songId) {
                void supabase.from('songs').update({ deezer_id: foundDeezerId }).eq('id', songId);
              }
              
              return flacUrl;
            } else {
              console.warn('⚠️ Deezmate réponse invalide (pas de FLAC):', data);
            }
          } else {
            console.warn('⚠️ Deezmate API error:', res.status);
          }
        } catch (error) {
          console.warn('⚠️ Deezmate échec:', error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Erreur recherche Deezer:', error);
    }
  }

  // ========== FALLBACK: TIDAL ==========
  // Si Deezer a échoué, essayer Tidal
  console.log('🔍 [FALLBACK] Vérification conditions Tidal - Title:', !!songTitle, 'Artist:', !!songArtist);
  
  if (songTitle && songArtist) {
    console.log('🎵 [TIDAL] Tentative fallback Tidal pour:', songTitle, '-', songArtist);
    
    try {
      // Chercher le Tidal ID (ou utiliser celui fourni)
      let foundTidalId = tidalId;
      
      if (!foundTidalId) {
        console.log('🔍 [TIDAL] Recherche Tidal ID...');
        const tidalIds = await searchTidalIds(songTitle, songArtist, 1);
        foundTidalId = tidalIds[0] || null;
        console.log('🔍 [TIDAL] IDs trouvés:', tidalIds);
      } else {
        console.log('✅ [TIDAL] Tidal ID déjà fourni:', foundTidalId);
      }
      
      if (foundTidalId) {
        console.log('🎵 [TIDAL] Tidal ID sélectionné:', foundTidalId);
        
        // Essayer de récupérer l'URL audio depuis les APIs Tidal
        const tidalUrl = await getTidalAudioUrl(foundTidalId);
        
        if (tidalUrl) {
          console.log('✅ [TIDAL] URL obtenue avec succès:', tidalUrl);
          
          // Sauvegarder le Tidal ID dans la table songs si on a un songId
          if (songId) {
            console.log('💾 [TIDAL] Sauvegarde Tidal ID dans la DB');
            void supabase.from('songs').update({ tidal_id: foundTidalId }).eq('id', songId);
          }
          
          return tidalUrl;
        } else {
          console.warn('❌ [TIDAL] Échec récupération URL pour ID:', foundTidalId);
        }
      } else {
        console.warn('❌ [TIDAL] Aucun Tidal ID trouvé');
      }
    } catch (error) {
      console.error('❌ [TIDAL] Erreur fallback:', error);
    }
  } else {
    console.log('⚠️ [TIDAL] Fallback impossible - Titre ou artiste manquant');
  }

  // ========== FALLBACK: STORAGE LOCAL UNIQUEMENT ==========
  // Si pas de deezerId ni Tidal trouvé, on passe directement au storage local (Supabase)
  
  console.log('⚠️ Aucun lien Deezmate/Tidal disponible, fallback vers storage local...');
  
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
