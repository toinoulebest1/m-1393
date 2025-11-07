import { supabase } from '@/integrations/supabase/client';

export interface GameSong {
  id: string;
  title: string;
  artist: string;
  url: string;
  imageUrl?: string;
  duration: string;
  isDeezer?: boolean;
}

/**
 * Vérifie si l'URL est une preview Deezer valide et jouable
 */
const isValidDeezerPreview = (url: string): boolean => {
  if (!url) return false;
  
  // Les previews Deezer valides sont sur cdns-preview-X.dzcdn.net
  const isDeezerCdn = url.includes('dzcdn.net') && url.includes('.mp3');
  
  // Exclure les liens Tidal, Spotify ou autres services avec tokens
  const isInvalidService = 
    url.includes('tidal.com') || 
    url.includes('spotify.com') ||
    url.includes('token=') ||
    url.includes('.mp4'); // Les previews Deezer sont en MP3, pas MP4
  
  return isDeezerCdn && !isInvalidService;
};

/**
 * Vérifie si l'URL est une URL audio valide (plus spécifique aux jeux)
 */
const isValidGameAudioUrl = (url: string): boolean => {
  if (!url) return false;
  
  // Accepter les URLs de fichiers locaux
  const isLocalFile = url.includes('supabase') || url.startsWith('blob:');
  
  // Accepter les URLs de streaming valides
  const isValidStreaming = 
    url.startsWith('http') && 
    !url.includes('token=') &&
    !url.includes('.mp4'); // On préfère l'audio pour les jeux
  
  return isLocalFile || isValidStreaming;
};

// Différentes requêtes Deezer pour varier les musiques
const deezerQueries = [
  'top hits 2024',
  'pop music',
  'rock classics',
  'hip hop',
  'electronic music',
  'french music',
  'indie music',
  'r&b soul',
  'latino hits',
  'jazz standards',
  'country music',
  'reggae',
  'top 50 france',
  'rap français',
  'dance music'
];

/**
 * Récupère un mix de chansons locales et Deezer pour les jeux
 */
export const fetchGameSongs = async (minSongs: number = 20): Promise<GameSong[]> => {
  try {
    // 1. Récupérer TOUTES les chansons locales pour pouvoir les mélanger
    const { data: localSongs, error: localError } = await supabase
      .from("songs")
      .select("*");

    if (localError) {
      console.error("Error fetching local songs:", localError);
    }

    // Mélanger aléatoirement les chansons locales
    const shuffledLocalSongs = (localSongs || []).sort(() => Math.random() - 0.5);
    
    const formattedLocalSongs: GameSong[] = shuffledLocalSongs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist || '',
      url: song.file_path,
      imageUrl: song.image_url,
      duration: song.duration || '0:00',
      isDeezer: false
    }));

    // 2. Toujours récupérer des tracks Deezer pour plus de variété
    console.log('🎵 Récupération de tracks Deezer pour varier les musiques...');
    
    // Sélectionner aléatoirement une requête Deezer
    const randomQuery = deezerQueries[Math.floor(Math.random() * deezerQueries.length)];
    
    const { data: deezerData, error: deezerError } = await supabase.functions.invoke('deezer-search', {
      body: { 
        query: randomQuery,
        limit: Math.max(30, minSongs)
      }
    });

    if (!deezerError && deezerData?.data) {
      const deezerTracks: GameSong[] = deezerData.data
        .map((track: any) => ({
          id: `deezer-${track.id}`,
          title: track.title,
          artist: track.artist?.name || '',
          url: track.preview || '',
          imageUrl: track.album?.cover_medium || track.album?.cover_big,
          duration: track.duration ? formatDuration(track.duration) : '0:30',
          isDeezer: true
        }))
        .filter((track: GameSong) => {
          // Filtrer les tracks sans URL ou avec des URLs non valides
          if (!track.url) {
            console.log(`❌ Track sans URL: ${track.title}`);
            return false;
          }
          if (!isValidGameAudioUrl(track.url)) {
            console.log(`❌ URL invalide pour les jeux: ${track.title} - ${track.url}`);
            return false;
          }
          return true;
        });

      console.log(`✅ ${deezerTracks.length} tracks Deezer récupérées (query: "${randomQuery}")`);
      
      // Mélanger les chansons locales et Deezer ensemble
      const allSongs = [...formattedLocalSongs, ...deezerTracks];
      return allSongs.sort(() => Math.random() - 0.5);
    }

    return formattedLocalSongs;
  } catch (error) {
    console.error("Exception while fetching game songs:", error);
    return [];
  }
};

/**
 * Formate la durée en secondes vers mm:ss
 */
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};