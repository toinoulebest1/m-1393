import { supabase } from '@/integrations/supabase/client';

export interface GameSong {
  id: string;
  title: string;
  artist: string;
  url: string;
  imageUrl?: string;
  duration: string;
}

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

/**
 * Récupère des chansons locales pour les jeux.
 */
export const fetchRandomGameSongs = async (minSongs: number = 20): Promise<GameSong[]> => {
  try {
    // Récupérer TOUTES les chansons locales pour pouvoir les mélanger
    const { data: localSongs, error: localError } = await supabase
      .from("songs")
      .select("*");

    if (localError) {
      console.error("Error fetching local songs:", localError);
      return [];
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
    }));

    console.log(`✅ ${formattedLocalSongs.length} chansons locales récupérées pour le jeu.`);
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