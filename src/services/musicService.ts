import { Song } from '@/types/player';
import { supabase } from '@/integrations/supabase/client';
import { searchTidalTracks, getTidalStreamUrl } from './tidalService';
import { searchQobuzTracks, getQobuzStreamUrl } from './qobuzService';

// Cache pour éviter de refaire la requête à chaque fois
let cachedProvider: string | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000; // 5 secondes

/**
 * Récupère le fournisseur d'API musicale configuré
 */
const getMusicApiProvider = async (): Promise<'tidal' | 'qobuz'> => {
  const now = Date.now();
  
  // Si le cache est valide, l'utiliser
  if (cachedProvider && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedProvider as 'tidal' | 'qobuz';
  }

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'music_api_provider')
      .maybeSingle();

    if (error) {
      console.error('[MusicService] Erreur lors de la récupération du provider:', error);
      cachedProvider = 'tidal'; // Fallback vers Tidal
    } else {
      cachedProvider = data?.value || 'tidal';
    }

    lastFetchTime = now;
    return cachedProvider as 'tidal' | 'qobuz';
  } catch (error) {
    console.error('[MusicService] Erreur:', error);
    return 'tidal'; // Fallback vers Tidal
  }
};

/**
 * Recherche des pistes selon le fournisseur configuré
 */
export const searchMusicTracks = async (query: string): Promise<Song[]> => {
  const provider = await getMusicApiProvider();
  console.log(`[MusicService] Recherche avec le provider: ${provider}`);

  if (provider === 'qobuz') {
    try {
      const results = await searchQobuzTracks(query);
      if (results && results.length > 0) {
        return results;
      }
      console.warn('[MusicService] Qobuz a renvoyé 0 résultat ou est bloqué (403/429). Fallback vers Tidal.');
      return await searchTidalTracks(query);
    } catch (err) {
      console.warn('[MusicService] Échec de la recherche Qobuz, fallback vers Tidal.', err);
      return await searchTidalTracks(query);
    }
  } else {
    return searchTidalTracks(query);
  }
};

/**
 * Récupère l'URL de streaming selon le fournisseur configuré
 */
export const getMusicStreamUrl = async (trackId: string, provider?: 'tidal' | 'qobuz'): Promise<{ url: string } | null> => {
  // Si le provider n'est pas spécifié, le détecter
  const apiProvider = provider || await getMusicApiProvider();
  console.log(`[MusicService] Récupération de l'URL de stream avec: ${apiProvider}, trackId: ${trackId}`);

  if (apiProvider === 'qobuz') {
    return getQobuzStreamUrl(trackId);
  } else {
    return getTidalStreamUrl(trackId);
  }
};

/**
 * Détecte le type de provider depuis l'URL de la chanson
 */
export const detectProviderFromUrl = (url: string): 'tidal' | 'qobuz' | null => {
  if (url.startsWith('tidal:')) {
    return 'tidal';
  } else if (url.startsWith('qobuz:')) {
    return 'qobuz';
  }
  return null;
};

/**
 * Invalide le cache du provider (utile après un changement de paramètres)
 */
export const invalidateProviderCache = () => {
  cachedProvider = null;
  lastFetchTime = 0;
};
