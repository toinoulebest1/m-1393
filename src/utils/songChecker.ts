
import { supabase } from "@/integrations/supabase/client";

export const checkIfSongExists = async (artist: string, title: string): Promise<boolean> => {
  try {
    const { data: existingSongs, error } = await supabase
      .from('songs')
      .select('id')
      .ilike('artist', artist)
      .ilike('title', title)
      .limit(1);

    if (error) {
      console.error("Erreur lors de la vérification de la chanson:", error);
      return false;
    }

    return existingSongs && existingSongs.length > 0;
  } catch (error) {
    console.error("Erreur lors de la vérification de la chanson:", error);
    return false;
  }
};
