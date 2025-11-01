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

// Fonction pour chercher automatiquement un titre sur Tidal avec plusieurs tentatives
export const searchTidalId = async (title: any, artist: any): Promise<string | null> => {
  const safeTitle = String(title ?? '').trim();
  const safeArtist = String(artist ?? '').trim();
  // Utiliser le format "titre, artiste" avec virgule pour plus de précision
  const searchQueries = [
    `${safeTitle}, ${safeArtist}`.trim(), // 1. Titre, artiste (format optimal - priorité)
    `${safeTitle} ${safeArtist}`.trim(), // 2. Titre + artiste
    `${safeArtist} ${safeTitle}`.trim(), // 3. Artiste + titre
    safeTitle, // 4. Titre seul (en dernier recours)
  ].filter(q => q.length > 0);
  
  console.log('🔎 Recherche Tidal avec', searchQueries.length, 'combinaisons');
  
  for (let i = 0; i < searchQueries.length; i++) {
    const query = searchQueries[i];
    console.log(`🔎 Tentative ${i + 1}/${searchQueries.length}:`, query);
    
    try {
      // Essayer Frankfurt en priorité
      let searchUrl = `https://frankfurt.monochrome.tf/search/?s=${encodeURIComponent(query)}`;
      let res = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
      
      // Fallback sur Phoenix si Frankfurt échoue
      if (!res.ok) {
        searchUrl = `https://phoenix.squid.wtf/search/?s=${encodeURIComponent(query)}`;
        res = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
        
        if (!res.ok) {
          console.warn(`⚠️ Échec tentative ${i + 1}, essayer suivante`);
          continue; // Essayer la prochaine combinaison
        }
      }
      
      const data = await res.json();
      // Phoenix peut retourner directement un tableau ou un objet avec diverses clés
      let results = [];
      if (Array.isArray(data)) {
        results = data;
      } else if (data?.tracks) {
        results = data.tracks;
      } else if (data?.results) {
        results = data.results;
      } else if (data?.data) {
        results = data.data;
      } else if (data?.items) {
        results = data.items;
      }
      
      console.log(`📦 Tentative ${i + 1}: ${results.length} résultats`);
      
      if (!results || results.length === 0) {
        console.warn(`⚠️ Aucun résultat pour tentative ${i + 1}, essayer suivante`);
        continue; // Essayer la prochaine combinaison
      }
    
      const normalize = (s: any) => String(s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const simplifyTitle = (s: any) => normalize(s).split(/\s*-\s*|\(|\[|\{/)[0];

      const expectedArtist = normalize(safeArtist);
      const expectedTitle = simplifyTitle(safeTitle);
      const aliases = new Set<string>([
        expectedArtist,
        expectedArtist.replace(/^maitre\s+/,'').trim(), // "maitre gims" -> "gims"
        expectedArtist.replace('gims','maitre gims').trim(),
      ]);

      // Helper robuste pour extraire UNIQUEMENT un ID Tidal d'un résultat hétérogène
      const extractTidalId = (obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        // 1) Champs explicites
        if (obj.tidalId) return String(obj.tidalId);
        if (obj.tidal_id) return String(obj.tidal_id);
        if (obj.tidal?.id) return String(obj.tidal.id);
        // 2) Résultats typés (service/provider/platform/source)
        const provider = (obj.service || obj.provider || obj.platform || obj.source || '').toString().toLowerCase();
        if (provider === 'tidal') {
          const direct = obj.id ?? obj.trackId ?? null;
          if (direct) return String(direct);
        }
        // 3) URL/chemins qui pointent vers Tidal
        const link = obj.url || obj.link || obj.permalink || obj.webUrl || obj.web_url || '';
        if (typeof link === 'string') {
          const m1 = link.match(/tidal\.com\/.*track\/(\d+)/i);
          if (m1?.[1]) return m1[1];
          const m2 = link.match(/[?&]trackId=(\d+)/i);
          if (m2?.[1]) return m2[1];
        }
        // 4) Nids communs
        if (obj.data && typeof obj.data === 'object') {
          const nested = extractTidalId(obj.data);
          if (nested) return nested;
        }
        return null; // Ne jamais retourner un id non-Tidal (ex: Deezer)
      };

      let bestMatch: any = null;
      let bestScore = -1;

      for (const track of results) {
        const candId = extractTidalId(track);
        if (!candId) continue; // ignorer les résultats non-Tidal

        const candTitle = simplifyTitle(track.title || track.name || track.trackName || '');
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

        let score = 0;
        if (hasExactArtist) score += 100; else if (hasPartialArtist) score += 50;
        if (titleExact) score += 30; else if (titleStarts) score += 15; else if (titleIncludes) score += 10;
        const popularity = track.popularity || track.popularityScore || 0;
        score += Math.min(5, Math.floor(popularity / 20));

        if (score > bestScore) {
          bestScore = score;
          bestMatch = track;
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
      
      const matchId = bestMatch ? extractTidalId(bestMatch) : null;
      
      if (matchId) {
        console.log(`✅ Tidal ID trouvé (tentative ${i + 1}):`, matchId);
        
        // Sauvegarder automatiquement le tidal_id dans la DB
        try {
          const { data: songs } = await supabase
            .from('songs')
            .select('id')
            .ilike('title', safeTitle)
            .ilike('artist', safeArtist)
            .limit(1);
            
          if (songs && songs.length > 0) {
            await supabase
              .from('songs')
              .update({ tidal_id: matchId.toString() })
              .eq('id', songs[0].id);
            console.log('💾 Tidal ID sauvegardé dans la DB');
          }
        } catch (e) {
          console.warn('⚠️ Impossible de sauvegarder le tidal_id:', e);
        }
        
        return matchId.toString();
      }
      
      console.warn(`⚠️ Tentative ${i + 1} sans résultat valide, continuer`);
    } catch (error) {
      console.error(`❌ Erreur tentative ${i + 1}:`, error);
      continue; // Essayer la prochaine combinaison
    }
  }
  
  console.error('❌ Aucun Tidal ID trouvé après toutes les tentatives');
  return null;
};

export const getAudioFileUrl = async (filePath: string, tidalId?: string, songTitle?: string, songArtist?: string): Promise<string> => {
  console.log('🔍 Récupération URL pour:', filePath, 'Tidal ID:', tidalId);

  // 0. Vérifier d'abord si un lien manuel existe dans tidal_audio_links
  if (tidalId) {
    console.log('🔍 Vérification lien manuel pour Tidal ID:', tidalId);
    try {
      const { data: manualLink, error } = await supabase
        .from('tidal_audio_links')
        .select('audio_url')
        .eq('tidal_id', tidalId)
        .maybeSingle();

      if (!error && manualLink?.audio_url) {
        console.log('✅ Lien manuel trouvé dans tidal_audio_links:', manualLink.audio_url);
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

  // Helper: Phoenix/Tidal fetch → OriginalTrackUrl (robuste)
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
        { name: 'Frankfurt', url: `https://frankfurt.monochrome.tf/track/?id=${tid}&quality=${quality}` },
        { name: 'London', url: `https://london.monochrome.tf/track/?id=${tid}&quality=${quality}` },
        { name: 'Katze', url: `https://katze.qqdl.site/track/?id=${tid}&quality=${quality}` },
        { name: 'Phoenix', url: `https://phoenix.squid.wtf/track/?id=${tid}&quality=${quality}` }
      ];
      
      let res: Response | null = null;
      let successApi: string | null = null;
      
      // Essayer chaque API dans l'ordre
      for (const api of apis) {
        console.log(`🎵 ${api.name} API:`, api.url);
        try {
          res = await fetch(api.url, { headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(`${api.name} API error: ${res.status}`);
          successApi = api.name;
          break; // API réussie, sortir de la boucle
        } catch (error) {
          console.warn(`⚠️ ${api.name} API échec (${quality}):`, error);
          lastError = error as Error;
          // Continuer avec l'API suivante
        }
      }
      
      // Si aucune API n'a fonctionné pour cette qualité, essayer la qualité suivante
      if (!res || !successApi) {
        console.warn(`⚠️ Toutes les APIs ont échoué pour la qualité ${quality}`);
        continue;
      }
      
      console.log(`✅ Utilisation de ${successApi} API avec qualité ${quality}`);

      // Parser la réponse
      let data: any;
      let rawText: string | null = null;
      try {
        data = await res.json();
      } catch (e) {
        rawText = await res.text();
        try {
          data = JSON.parse(rawText);
        } catch {
          console.warn(`⚠️ Phoenix non-JSON réponse (${quality}):`, rawText?.slice(0, 200));
          lastError = new Error('Phoenix a renvoyé une réponse inattendue');
          continue; // Essayer la qualité suivante
        }
      }

      // Cas où Phoenix renvoie un tableau (observé dans les logs)
      if (Array.isArray(data)) {
        // Priorité absolue: chercher l'élément qui contient OriginalTrackUrl
        for (const item of data) {
          if (item?.OriginalTrackUrl && typeof item.OriginalTrackUrl === 'string') {
            console.log(`✅ Phoenix OriginalTrackUrl (array, ${quality}):`, item.OriginalTrackUrl);
            return item.OriginalTrackUrl;
          }
        }
        
        // Fallback: autres champs ou manifest
        for (const item of data) {
          const direct = pickDirect(item);
          // Ignorer les URLs tidal.com/track qui sont des pages web
          if (direct && !direct.includes('tidal.com/track/') && !direct.includes('www.tidal.com')) {
            console.log(`✅ Phoenix URL (array fallback, ${quality}):`, direct);
            return direct;
          }
          if (item?.manifest) {
            const fromManifest = await extractFromManifest(item.manifest);
            if (fromManifest) {
              console.log(`✅ Phoenix URL (manifest, ${quality}):`, fromManifest);
              return fromManifest;
            }
          }
        }
        
        // Si rien trouvé dans le array, essayer la qualité suivante
        console.warn(`⚠️ Phoenix JSON sans OriginalTrackUrl (array, ${quality})`);
        lastError = new Error('OriginalTrackUrl introuvable dans la réponse Phoenix');
        continue;
      }

      // Objet standard
      const directTop = pickDirect(data);
      if (directTop) {
        console.log(`✅ Phoenix OriginalTrackUrl (${quality}):`, directTop);
        return directTop;
      }

      // Exploration des champs imbriqués
      if (data && typeof data === 'object') {
        for (const key of Object.keys(data)) {
          const val: any = (data as any)[key];
          if (val && typeof val === 'object') {
            const d = pickDirect(val);
            if (d) {
              console.log(`✅ Phoenix OriginalTrackUrl (nested, ${quality}):`, d);
              return d;
            }
            if (val?.manifest) {
              const fromManifest = await extractFromManifest(val.manifest);
              if (fromManifest) return fromManifest;
            }
          }
        }
      }

      console.warn(`⚠️ Phoenix JSON sans OriginalTrackUrl (${quality})`);
      lastError = new Error('OriginalTrackUrl introuvable dans la réponse Phoenix');
      // Continuer avec la qualité suivante
    }
    
    // Si toutes les qualités ont échoué
    console.error('❌ Aucune qualité disponible après toutes les tentatives');
    throw lastError || new Error('OriginalTrackUrl introuvable après toutes les tentatives');
  };
  
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

    // Si pas en cache, récupérer depuis l'API
    console.log('🔄 Pas en cache, récupération depuis API...');
    const direct = await fetchPhoenixUrl(tidalId);
    
    // Sauvegarder dans la table pour les prochaines fois
    await supabase
      .from('tidal_audio_links')
      .upsert({
        tidal_id: tidalId,
        audio_url: direct,
        quality: 'LOSSLESS',
        source: 'frankfurt',
        last_verified_at: new Date().toISOString()
      });
    console.log('💾 Lien sauvegardé dans tidal_audio_links');
    
    return direct;
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
    
    let foundTidalId = existingSong?.tidal_id;
    
    // Si pas trouvé dans songs, chercher via l'API
    if (!foundTidalId) {
      console.log('🌐 Pas en DB, recherche via API...');
      foundTidalId = await searchTidalId(songTitle, songArtist);
    } else {
      console.log('✅ Tidal ID trouvé dans la DB:', foundTidalId);
    }
    
    if (foundTidalId) {
      // Vérifier d'abord en cache audio links
      const { data: cachedLink } = await supabase
        .from('tidal_audio_links')
        .select('audio_url')
        .eq('tidal_id', foundTidalId)
        .single();

      if (cachedLink) {
        console.log('✅ URL trouvée en cache DB (auto-search)');
        return cachedLink.audio_url;
      }

      // Sinon fetch depuis l'API
      const direct = await fetchPhoenixUrl(foundTidalId);
      
      // Sauvegarder dans la table
      await supabase
        .from('tidal_audio_links')
        .upsert({
          tidal_id: foundTidalId,
          audio_url: direct,
          quality: 'LOSSLESS',
          source: 'frankfurt',
          last_verified_at: new Date().toISOString()
        });
      console.log('💾 Lien sauvegardé dans tidal_audio_links (auto-search)');
      
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
