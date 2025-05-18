
import { supabase } from '@/integrations/supabase/client';

export interface DeezerArtist {
  id: number;
  name: string;
  link: string;
  share: string;
  picture: string;
  picture_small: string;
  picture_medium: string;
  picture_big: string;
  picture_xl: string;
  nb_album: number;
  nb_fan: number;
  radio: boolean;
  tracklist: string;
  type: string;
}

export interface DeezerTrack {
  id: number;
  title: string;
  link: string;
  duration: number;
  rank: number;
  preview: string;
  artist: {
    id: number;
    name: string;
    link: string;
    picture: string;
    picture_small: string;
    picture_medium: string;
    picture_big: string;
    picture_xl: string;
    type: string;
  };
  album: {
    id: number;
    title: string;
    cover: string;
    cover_small: string;
    cover_medium: string;
    cover_big: string;
    cover_xl: string;
    type: string;
  };
  type: string;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  link: string;  // Added the missing link property
  cover: string;
  cover_small: string;
  cover_medium: string;
  cover_big: string;
  cover_xl: string;
  release_date: string;
  tracklist: string;
  type: string;
}

export interface ArtistProfileResponse {
  artist: DeezerArtist;
  topTracks: DeezerTrack[];
  albums: DeezerAlbum[];
}

/**
 * Recherche un artiste par son nom
 */
export const searchArtist = async (artistName: string): Promise<ArtistProfileResponse | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('deezer-artist', {
      body: { artistName }
    });
    
    if (error) {
      console.error("Error fetching artist profile:", error);
      return null;
    }
    
    return data as ArtistProfileResponse;
  } catch (error) {
    console.error("Exception while searching for artist:", error);
    return null;
  }
};

/**
 * Récupère le profil d'un artiste par son ID Deezer
 */
export const getArtistById = async (artistId: number): Promise<ArtistProfileResponse | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('deezer-artist', {
      body: { artistId }
    });
    
    if (error) {
      console.error("Error fetching artist profile:", error);
      return null;
    }
    
    return data as ArtistProfileResponse;
  } catch (error) {
    console.error("Exception while fetching artist by ID:", error);
    return null;
  }
};
