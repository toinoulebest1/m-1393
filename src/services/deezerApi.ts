import { supabase } from '@/integrations/supabase/client';

// Deezer Artist interface
export interface DeezerArtist {
  id: string;
  name: string;
  picture?: string;
  picture_medium?: string;
  picture_big?: string;
  nb_fan?: number;
}

export const deezerApi = {
  searchArtist: async (query: string): Promise<DeezerArtist[]> => {
    return [];
  }
};

/**
 * Récupère l'URL de streaming Deezer via l'edge function
 */
export const getDeezerStreamUrl = async (trackId: string, quality: number = 2): Promise<{ url: string } | null> => {
  try {
    console.log(`[Deezer] Demande de stream pour track ${trackId}, qualité ${quality}`);

    const { data, error } = await supabase.functions.invoke('deezer-stream', {
      body: { trackId, quality }
    });

    if (error) {
      console.error('[Deezer] Erreur edge function:', error);
      return null;
    }

    if (!data || !data.url) {
      console.error('[Deezer] Aucune URL retournée');
      return null;
    }

    console.log(`[Deezer] URL de stream obtenue`);
    
    return { url: data.url };
  } catch (error) {
    console.error('[Deezer] Erreur lors de la récupération de l\'URL:', error);
    return null;
  }
};

/**
 * Extrait l'ID de track depuis une URL Deezer
 */
export const extractDeezerTrackId = (url: string): string | null => {
  const patterns = [
    /deezer\.com\/..\/(track|chanson)\/(\d+)/,
    /deezer\.com\/track\/(\d+)/,
    /track\/(\d+)/,
    /^deezer:(\d+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[match.length - 1];
    }
  }

  // Si c'est juste un nombre
  if (/^\d+$/.test(url)) {
    return url;
  }

  return null;
};

