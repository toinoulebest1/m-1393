// Deezer API service stub
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

