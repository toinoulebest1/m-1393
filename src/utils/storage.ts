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
    const response = await fetch(`https://api.deezer.com/2.0/track/isrc:${isrc}`);
    
    if (!response.ok) {
      console.warn('⚠️ API Deezer ISRC error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.id) {
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
    console.log('🔍 Recherche Deezer ID par titre/artiste:', title, '-', artist);
    const query = `artist:"${artist}" track:"${title}"`;
    const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`);
    
    if (!response.ok) {
      console.warn('⚠️ API Deezer search error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      // Prendre le premier résultat
      const track = data.data[0];
      console.log('✅ Deezer ID trouvé par recherche:', track.id);
      return String(track.id);
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ Erreur recherche Deezer par titre/artiste:', error);
    return null;
  }
};

// Recherche l'ISRC d'un track Tidal
export const searchTidalIsrc = async (title: string, artist: string): Promise<string | null> => {
  try {
    const query = `${title}, ${artist}`;
    const apis = [
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

export const getAudioFileUrl = async (filePath: string, deezerId?: string, songTitle?: string, songArtist?: string, tidalId?: string): Promise<string> => {
  console.log('🔍 Récupération URL pour:', filePath, 'Deezer ID:', deezerId, 'Tidal ID:', tidalId);

  // PRIORITÉ ABSOLUE: API Deezmate si un deezerId est fourni
  if (deezerId) {
    console.log('🎵 Essai API Deezmate avec ID:', deezerId);
    try {
      const url = `https://api.deezmate.com/dl/${deezerId}`;
      console.log('📡 Appel Deezmate:', url);
      const res = await fetch(url);
      
      if (res.ok) {
        const data = await res.json();
        
        // Extraire le lien FLAC du JSON
        const flacUrl = data?.flac || data?.FLAC;
        
        if (flacUrl && typeof flacUrl === 'string' && flacUrl.startsWith('http')) {
          console.log('✅ Deezmate URL FLAC obtenue:', flacUrl);
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

  // Si pas de deezerId mais on a titre + artiste, essayer de trouver l'ID Deezer
  if (!deezerId && songTitle && songArtist) {
    console.log('🔎 Tentative recherche Deezer ID...');
    let foundDeezerId: string | null = null;
    
    try {
      // Méthode 1 : Recherche directe par titre/artiste sur Deezer
      foundDeezerId = await searchDeezerIdByTitleArtist(songTitle, songArtist);
      
      // Méthode 2 : Si pas trouvé, essayer via ISRC
      if (!foundDeezerId) {
        console.log('🔎 Recherche via ISRC...');
        const isrc = await searchTidalIsrc(songTitle, songArtist);
        
        if (isrc) {
          foundDeezerId = await searchDeezerIdFromIsrc(isrc);
        }
      }
      
      // Si on a trouvé un ID Deezer, essayer Deezmate
      if (foundDeezerId) {
        console.log('🎵 ID Deezer trouvé:', foundDeezerId);
        try {
          const url = `https://api.deezmate.com/dl/${foundDeezerId}`;
          console.log('📡 Appel Deezmate:', url);
          const res = await fetch(url);
          
          if (res.ok) {
            const data = await res.json();
            
            // Extraire le lien FLAC du JSON
            const flacUrl = data?.flac || data?.FLAC;
            
            if (flacUrl && typeof flacUrl === 'string' && flacUrl.startsWith('http')) {
              console.log('✅ Deezmate URL FLAC obtenue:', flacUrl);
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

  // Helper: Phoenix/Tidal fetch → OriginalTrackUrl (robuste) - fallback
  const fetchPhoenixUrl = async (tid: string): Promise<string> => {
    // Helper interne: extraire depuis un manifest éventuel
    const extractFromManifest = async (manifest: string): Promise<string | null> => {
      try {
        const decoded = atob(manifest);
        // Essayer JSON d'abord
        try {
          const mObj = JSON.parse(decoded);
          const direct = mObj?.OriginalTrackUrl || mObj?.originalTrackUrl || mObj?.original_url || mObj?.url || (Array.isArray(mObj?.urls) ? mObj.urls[0] : null);
          if (typeof direct === 'string') return direct;
        } catch {}
        // Fallback: regex URL
        const match = decoded.match(/https?:\/\/[^"'\s]+/);
        if (match) return match[0];
      } catch {
        // Peut déjà être du texte non base64
        const match = manifest.match(/https?:\/\/[^"'\s]+/);
        if (match) return match[0];
      }
      return null;
    };

    // Helper interne: choisir la propriété directe si présente
    const pickDirect = (obj: any): string | null => {
      const direct = obj?.OriginalTrackUrl || obj?.originalTrackUrl || obj?.original_url || obj?.url;
      return typeof direct === 'string' ? direct : null;
    };

    // Liste des qualités à essayer (ordre de priorité)
    const qualities = ['LOSSLESS', 'LOW'];
    let lastError: Error | null = null;
    
    for (const quality of qualities) {
      console.log(`🎵 Tentative qualité ${quality}...`);
      
      // Liste des APIs à essayer (ordre de priorité)
      const apis = [
        { name: 'Katze', url: `https://katze.qqdl.site/track/?id=${tid}&quality=${quality}` },
        { name: 'Ohio', url: `https://ohio.monochrome.tf/track/?id=${tid}&quality=${quality}` },
        { name: 'Frankfurt', url: `https://frankfurt.monochrome.tf/track/?id=${tid}&quality=${quality}` },
        { name: 'London', url: `https://london.monochrome.tf/track/?id=${tid}&quality=${quality}` },
        { name: 'Phoenix', url: `https://phoenix.squid.wtf/track/?id=${tid}&quality=${quality}` }
      ];
      
      // Essayer chaque API dans l'ordre et ne s'arrêter que lorsqu'un lien VALIDE est trouvé
      let foundUrl: string | null = null;
      for (const api of apis) {
        console.log(`🎵 ${api.name} API:`, api.url);
        try {
          const res = await fetch(api.url, { headers: { Accept: 'application/json' } });
          if (!res.ok) {
            console.warn(`⚠️ ${api.name} API error: ${res.status}`);
            continue;
          }

          const data = await res.json();

          // Tentative directe (top-level)
          const directTop = pickDirect(data);
          if (directTop) {
            const invalid = directTop.includes('amz-pr-fa.audio.tidal.com') || directTop.includes('tidal.com/track/') || directTop.includes('www.tidal.com');
            if (!invalid) {
              console.log(`✅ ${api.name} OriginalTrackUrl (${quality}):`, directTop);
              foundUrl = directTop;
              break;
            } else {
              console.warn(`⚠️ ${api.name} a renvoyé un lien invalide (${quality}): ${directTop}`);
            }
          }

          // Exploration des champs imbriqués + manifest
          if (data && typeof data === 'object') {
            outer: for (const key of Object.keys(data)) {
              const val: any = (data as any)[key];
              if (val && typeof val === 'object') {
                const d = pickDirect(val);
                if (d) {
                  const invalid = d.includes('amz-pr-fa.audio.tidal.com') || d.includes('tidal.com/track/') || d.includes('www.tidal.com');
                  if (!invalid) {
                    console.log(`✅ ${api.name} OriginalTrackUrl (nested, ${quality}):`, d);
                    foundUrl = d;
                    break outer;
                  } else {
                    console.warn(`⚠️ ${api.name} lien nested invalide (${quality}): ${d}`);
                  }
                }
                if (val?.manifest) {
                  const fromManifest = await extractFromManifest(val.manifest);
                  if (fromManifest) {
                    const invalid = fromManifest.includes('amz-pr-fa.audio.tidal.com') || fromManifest.includes('tidal.com/track/') || fromManifest.includes('www.tidal.com');
                    if (!invalid) {
                      console.log(`✅ ${api.name} URL depuis manifest (${quality}):`, fromManifest);
                      foundUrl = fromManifest;
                      break outer;
                    } else {
                      console.warn(`⚠️ ${api.name} manifest invalide (${quality}): ${fromManifest}`);
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ ${api.name} API échec (${quality}):`, error);
          lastError = error as Error;
          // Essayer l'API suivante
        }

        if (foundUrl) break; // URL valide trouvée, sortir de la boucle APIs
      }

      if (foundUrl) {
        return foundUrl; // Retourner l'URL valide trouvée pour cette qualité
      }

      console.warn(`⚠️ Aucune API n'a fourni de lien valide pour la qualité ${quality}`);
      // Continuer avec la qualité suivante
    }
    
    // Si toutes les qualités ont échoué
    console.error('❌ Aucune qualité disponible après toutes les tentatives');
    throw lastError || new Error('OriginalTrackUrl introuvable après toutes les tentatives');
  };
  
  // Helper: Essayer plusieurs Tidal IDs jusqu'à obtenir un lien valide (pas amz-pr-fa)
  const fetchWithFallback = async (tidalIds: string[]): Promise<string> => {
    for (let i = 0; i < tidalIds.length; i++) {
      const tid = tidalIds[i];
      console.log(`🔄 Tentative avec Tidal ID #${i + 1}:`, tid);
      
      // D'ABORD vérifier dans le cache DB avant de faire des requêtes API
      try {
        const { data: cachedLink } = await supabase
          .from('tidal_audio_links')
          .select('audio_url, expires_at')
          .eq('tidal_id', tid)
          .maybeSingle();
        
        if (cachedLink?.audio_url) {
          const isInvalidLink = cachedLink.audio_url.includes('amz-pr-fa.audio.tidal.com') || 
                               cachedLink.audio_url.includes('tidal.com/track/') ||
                               cachedLink.audio_url.includes('www.tidal.com');
          
          // Vérifier si le lien n'est pas expiré
          const isExpired = cachedLink.expires_at && new Date(cachedLink.expires_at) < new Date();
          
          if (!isInvalidLink && !isExpired) {
            console.log(`✅ Lien valide trouvé en cache DB (ID: ${tid}):`, cachedLink.audio_url);
            return cachedLink.audio_url; // Retourner immédiatement le lien en cache
          } else if (isExpired) {
            console.warn(`⏰ Lien expiré en cache pour ID ${tid}, rafraîchissement depuis l'API...`);
          } else {
            console.warn(`⚠️ Lien invalide en cache pour ID ${tid}, continuer la recherche API`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Erreur vérification cache pour ID ${tid}:`, error);
      }
      
      // Si pas en cache ou invalide, récupérer depuis l'API
      try {
        const audioUrl = await fetchPhoenixUrl(tid);
        
        // Vérifier si le lien est valide (pas amz-pr-fa ni URL web Tidal)
        const isInvalidLink = audioUrl.includes('amz-pr-fa.audio.tidal.com') || 
                             audioUrl.includes('tidal.com/track/') ||
                             audioUrl.includes('www.tidal.com');
        
        if (isInvalidLink) {
          console.warn(`⚠️ Lien invalide détecté (ID: ${tid}): ${audioUrl}, essayer prochain ID...`);
          continue; // Essayer le prochain ID sans sauvegarder
        }
        
        console.log(`✅ Lien audio valide obtenu avec ID #${i + 1}: ${tid}`);
        
        // Calculer la date d'expiration (23h à partir de maintenant, car liens Tidal expirent après 24h)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 23);
        
        // Sauvegarder uniquement les liens audio directs valides
        await supabase
          .from('tidal_audio_links')
          .upsert({
            tidal_id: tid,
            audio_url: audioUrl,
            quality: 'LOSSLESS',
            source: 'frankfurt',
            last_verified_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString()
          });
        console.log('💾 Lien audio valide sauvegardé dans tidal_audio_links (expire dans 23h)');
        
        return audioUrl;
      } catch (error) {
        console.warn(`❌ Erreur avec ID #${i + 1}:`, error);
        if (i === tidalIds.length - 1) throw error; // Dernière tentative, lancer l'erreur
      }
    }
    
    throw new Error('Aucun lien valide trouvé après toutes les tentatives');
  };

  // 0. Vérifier d'abord si un lien manuel existe dans tidal_audio_links
  if (tidalId) {
    console.log('🔍 Vérification lien manuel pour Tidal ID:', tidalId);
    try {
      const { data: manualLink, error } = await supabase
        .from('tidal_audio_links')
        .select('audio_url, expires_at')
        .eq('tidal_id', tidalId)
        .maybeSingle();

      if (!error && manualLink?.audio_url) {
        console.log('✅ Lien trouvé dans tidal_audio_links:', manualLink.audio_url);
        
        // Vérifier si le lien est valide (pas amz-pr-fa ni URL web Tidal)
        const isInvalidLink = manualLink.audio_url.includes('amz-pr-fa.audio.tidal.com') || 
                             manualLink.audio_url.includes('tidal.com/track/') ||
                             manualLink.audio_url.includes('www.tidal.com');
        
        // Vérifier si le lien n'est pas expiré
        const isExpired = manualLink.expires_at && new Date(manualLink.expires_at) < new Date();
        
        if (isInvalidLink || isExpired) {
          if (isExpired) {
            console.warn('⏰ Lien expiré en cache, rafraîchissement...');
          } else {
            console.warn('⚠️ Lien invalide en cache, recherche alternatives...');
          }
          
          // Si on a titre + artiste, chercher des IDs alternatifs
          if (songTitle && songArtist) {
            const alternativeIds = await searchTidalIds(songTitle, songArtist, 5);
            
            // Filtrer pour exclure l'ID actuel
            const otherIds = alternativeIds.filter(id => id !== tidalId);
            
            if (otherIds.length > 0) {
              console.log(`🔄 Réessai avec ${otherIds.length} IDs alternatifs`);
              return await fetchWithFallback(otherIds);
            } else {
              console.warn('⚠️ Aucun ID alternatif trouvé');
              throw new Error('Aucun lien audio valide trouvé pour cette musique');
            }
          } else {
            console.warn('⚠️ Pas de titre/artiste, impossible de chercher alternatives');
            throw new Error('Lien audio invalide et pas de métadonnées pour chercher des alternatives');
          }
        }
        
        return manualLink.audio_url;
      }
    } catch (error) {
      console.warn('⚠️ Erreur vérification lien manuel:', error);
    }
  }

  // 1. Si c'est une URL Deezer, chercher automatiquement sur Tidal
  if (filePath.includes('dzcdn.net') || filePath.includes('deezer.com')) {
    console.log('🎵 Détection Deezer, recherche automatique sur Tidal...');
    
    if (!songTitle || !songArtist) {
      throw new Error('Titre et artiste requis pour les musiques Deezer');
    }
    
    // Chercher le Tidal ID
    let foundTidalId = tidalId;
    
    if (!foundTidalId) {
      // D'abord chercher dans la DB
      const { data: existingSong } = await supabase
        .from('songs')
        .select('tidal_id')
        .ilike('title', songTitle)
        .ilike('artist', songArtist)
        .not('tidal_id', 'is', null)
        .limit(1)
        .single();
      
      foundTidalId = existingSong?.tidal_id;
      
      // Si pas trouvé, chercher via l'API
      if (!foundTidalId) {
        console.log('🔎 Recherche Tidal ID pour:', songTitle, '-', songArtist);
        foundTidalId = await searchTidalId(songTitle, songArtist);
      }
    }
    
    if (!foundTidalId) {
      throw new Error(`Impossible de trouver cette musique sur Tidal: ${songTitle} - ${songArtist}`);
    }
    
    // Maintenant qu'on a le Tidal ID, passer au flow normal
    tidalId = foundTidalId;
    console.log('✅ Tidal ID trouvé pour Deezer:', tidalId);

    // Vérifier immédiatement s'il existe un lien manuel pour ce Tidal ID
    console.log('🔍 VÉRIFICATION LIEN MANUEL - Tidal ID:', tidalId);
    try {
      const { data: manualLink2, error: manualError } = await supabase
        .from('tidal_audio_links')
        .select('audio_url, tidal_id')
        .eq('tidal_id', tidalId)
        .maybeSingle();
      
      console.log('📊 Résultat requête lien manuel:', { 
        found: !!manualLink2, 
        error: manualError, 
        data: manualLink2 
      });
      
      if (manualLink2?.audio_url) {
        console.log('✅ Lien manuel trouvé (post-détection Tidal):', manualLink2.audio_url);
        // Vérifier si le lien est invalide (amz-pr-fa ou URL web Tidal)
        if (manualLink2.audio_url.includes('amz-pr-fa.audio.tidal.com') || 
            manualLink2.audio_url.includes('tidal.com/track/') ||
            manualLink2.audio_url.includes('www.tidal.com')) {
          console.warn('⚠️ Lien manuel amz-pr-fa détecté (post-détection), recherche d’IDs alternatifs...');
          if (songTitle && songArtist && tidalId) {
            const alternativeIds = await searchTidalIds(songTitle, songArtist, 5);
            const otherIds = alternativeIds.filter((id) => id !== tidalId);
            if (otherIds.length > 0) {
              console.log(`🔄 Réessai avec ${otherIds.length} IDs alternatifs (post-détection)`);
              return await fetchWithFallback(otherIds);
            } else {
              console.warn('⚠️ Aucun ID alternatif trouvé (post-détection)');
              throw new Error('Aucun lien audio valide trouvé pour cette musique');
            }
          }
        }
        return manualLink2.audio_url;
      } else {
        console.log('⚠️ Aucun lien manuel trouvé pour Tidal ID:', tidalId);
        
        // Chercher TOUS les liens pour voir ce qui existe
        const { data: allLinks } = await supabase
          .from('tidal_audio_links')
          .select('tidal_id, audio_url, source')
          .limit(10);
        console.log('📋 Tous les liens manuels disponibles:', allLinks);
      }
    } catch (e) {
      console.error('❌ Erreur vérification lien manuel post-détection:', e);
    }
  }

  // 0. Vérifier d'abord dans le cache Supabase si un tidal_id est fourni
  if (tidalId) {
    // Vérifier dans la table tidal_audio_links
    const { data: cachedLink } = await supabase
      .from('tidal_audio_links')
      .select('audio_url, last_verified_at')
      .eq('tidal_id', tidalId)
      .single();

    if (cachedLink) {
      console.log('✅ URL trouvée en cache DB (tidal_audio_links)');
      return cachedLink.audio_url;
    }

    // Si pas en cache, récupérer depuis l'API avec fallback
    console.log('🔄 Pas en cache, récupération depuis API avec fallback...');
    
    // Si on a titre + artiste, chercher plusieurs IDs alternatifs
    if (songTitle && songArtist) {
      const alternativeIds = await searchTidalIds(songTitle, songArtist, 5);
      
      // Ajouter l'ID fourni au début si pas déjà présent
      if (!alternativeIds.includes(tidalId)) {
        alternativeIds.unshift(tidalId);
      }
      
      return await fetchWithFallback(alternativeIds);
    } else {
      // Pas de titre/artiste, juste essayer avec l'ID fourni
      const direct = await fetchPhoenixUrl(tidalId);
      
      // Vérifier si le lien est valide avant de sauvegarder
      const isInvalidLink = direct.includes('amz-pr-fa.audio.tidal.com') || 
                           direct.includes('tidal.com/track/') ||
                           direct.includes('www.tidal.com');
      
      if (!isInvalidLink) {
        await supabase
          .from('tidal_audio_links')
          .upsert({
            tidal_id: tidalId,
            audio_url: direct,
            quality: 'LOSSLESS',
            source: 'frankfurt',
            last_verified_at: new Date().toISOString()
          });
        console.log('💾 Lien audio valide sauvegardé dans tidal_audio_links');
      } else {
        console.warn('⚠️ Lien invalide non sauvegardé:', direct);
      }
      
      return direct;
    }
  }
  
  // 0-auto. Si pas de tidal_id mais on a titre + artiste, chercher automatiquement
  if (!tidalId && songTitle && songArtist) {
    console.log('🔍 Pas de Tidal ID, recherche automatique pour:', songTitle, '-', songArtist);
    
    // D'abord chercher dans la table songs si un tidal_id existe déjà
    const { data: existingSong } = await supabase
      .from('songs')
      .select('tidal_id')
      .ilike('title', songTitle)
      .ilike('artist', songArtist)
      .not('tidal_id', 'is', null)
      .limit(1)
      .single();
    
    let foundTidalIds: string[] = [];
    
    if (existingSong?.tidal_id) {
      console.log('✅ Tidal ID trouvé dans la DB:', existingSong.tidal_id);
      foundTidalIds.push(existingSong.tidal_id);
    }
    
    // Chercher via l'API pour avoir des alternatives
    console.log('🌐 Recherche alternatives via API...');
    const apiIds = await searchTidalIds(songTitle, songArtist, 5);
    
    // Fusionner les IDs (DB en premier, puis API sans doublons)
    for (const id of apiIds) {
      if (!foundTidalIds.includes(id)) {
        foundTidalIds.push(id);
      }
    }
    
    if (foundTidalIds.length === 0) {
      throw new Error(`Aucun ID Tidal trouvé pour: ${songTitle} - ${songArtist}`);
    }
    
    console.log(`📋 ${foundTidalIds.length} IDs Tidal à essayer`);
    return await fetchWithFallback(foundTidalIds);
  }

  // 0-bis. Si l'URL est déjà un lien Phoenix, extraire l'id et récupérer l'URL directe
  try {
    if (filePath.includes('phoenix.squid.wtf/track')) {
      const urlObj = new URL(filePath);
      const maybeId = urlObj.searchParams.get('id');
      if (maybeId) {
        return await fetchPhoenixUrl(maybeId);
      }
    }
  } catch (_) {}

  // 0-ter. Si le chemin commence par "tidal:{id}", utiliser Phoenix
  if (filePath.startsWith('tidal:')) {
    const extractedTidalId = filePath.replace('tidal:', '');
    return await fetchPhoenixUrl(extractedTidalId);
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
