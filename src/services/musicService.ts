import { Song } from '@/types/player';
import { supabase } from '@/integrations/supabase/client';
import { searchTidalTracks, getTidalStreamUrl } from './tidalService';
import { searchQobuzTracks, getQobuzStreamUrl } from './qobuzService';
import { getDeezerStreamUrl } from './deezerApi';

// Cache pour éviter de refaire la requête à chaque fois
let cachedProvider: string | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000; // 1 seconde seulement pour détecter rapidement les changements

// Clé localStorage pour détecter les changements de provider
const PROVIDER_CHANGE_KEY = 'music_provider_changed';

/**
 * Récupère le fournisseur d'API musicale configuré
 */
const getMusicApiProvider = async (): Promise<'tidal' | 'qobuz' | 'deezer'> => {
  const now = Date.now();
  
  // Vérifier si le provider a été changé manuellement
  const providerChanged = localStorage.getItem(PROVIDER_CHANGE_KEY);
  if (providerChanged) {
    console.log('[MusicService] Détection d\'un changement de provider, rechargement...');
    cachedProvider = null;
    lastFetchTime = 0;
    localStorage.removeItem(PROVIDER_CHANGE_KEY);
  }
  
  // Si le cache est valide, l'utiliser
  if (cachedProvider && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedProvider as 'tidal' | 'qobuz' | 'deezer';
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
    console.log(`[MusicService] Provider configuré: ${cachedProvider}`);
    return cachedProvider as 'tidal' | 'qobuz' | 'deezer';
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
    const results = await searchQobuzTracks(query);
    console.log(`[MusicService] Qobuz a renvoyé ${results.length} résultats`);
    return results;
  } else {
    return searchTidalTracks(query);
  }
};

/**
 * Récupère l'URL de streaming selon le fournisseur configuré
 */
export const getMusicStreamUrl = async (trackId: string, provider?: 'tidal' | 'qobuz' | 'deezer'): Promise<{ url: string } | null> => {
  // Si le provider n'est pas spécifié, le détecter
  const apiProvider = provider || await getMusicApiProvider();
  console.log(`[MusicService] Récupération de l'URL de stream avec: ${apiProvider}, trackId: ${trackId}`);

  if (apiProvider === 'qobuz') {
    return getQobuzStreamUrl(trackId);
  } else if (apiProvider === 'deezer') {
    return getDeezerStreamUrl(trackId);
  } else {
    return getTidalStreamUrl(trackId);
  }
};

/**
 * Détecte le type de provider depuis l'URL de la chanson
 */
export const detectProviderFromUrl = (url: string): 'tidal' | 'qobuz' | 'deezer' | null => {
  if (url.startsWith('tidal:')) {
    return 'tidal';
  } else if (url.startsWith('qobuz:')) {
    return 'qobuz';
  } else if (url.startsWith('deezer:')) {
    return 'deezer';
  }
  return null;
};

/**
 * Invalide le cache du provider (utile après un changement de paramètres)
 */
export const invalidateProviderCache = () => {
  cachedProvider = null;
  lastFetchTime = 0;
  // Signal pour tous les composants qu'ils doivent recharger
  localStorage.setItem(PROVIDER_CHANGE_KEY, Date.now().toString());
  console.log('[MusicService] Cache invalidé et signal de changement envoyé');
};
