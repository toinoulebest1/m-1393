import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Fetches lyrics for a song in the background.
 * It first checks if lyrics are already in the database.
 * If not, it calls a Supabase Edge Function to get them and then saves them.
 * @param songId - The ID of the song.
 * @param title - The title of the song.
 * @param artist - The artist of the song.
 * @param duration - The duration of the song (optional).
 * @param albumName - The album name of the song (optional).
 */
export const fetchLyricsInBackground = async (
  songId: string,
  title: string,
  artist: string,
  duration?: string,
  albumName?: string,
) => {
  if (!songId || !title || !artist) {
    console.warn('[Lyrics] Fetch skipped: missing songId, title, or artist.');
    return;
  }

  try {
    // 1. Check if lyrics already exist in the database
    console.log(`[Lyrics] Checking cache for: ${title}`);
    const { data: existingLyrics, error: checkError } = await supabase
      .from('lyrics')
      .select('id')
      .eq('song_id', songId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('[Lyrics] Error checking for existing lyrics:', checkError);
      return;
    }

    if (existingLyrics) {
      console.log(`[Lyrics] Cache hit for: ${title}. No fetch needed.`);
      return;
    }

    console.log(`[Lyrics] Cache miss for: ${title}. Fetching from source...`);
    
    // 2. If not found, invoke the edge function to fetch lyrics
    const { data, error: functionError } = await supabase.functions.invoke('generate-lyrics', {
      body: { 
        songTitle: title, 
        artist: artist,
        duration: duration,
        albumName: albumName,
      }
    });

    if (functionError) {
      console.error(`[Lyrics] Error fetching lyrics for "${title}":`, functionError);
      return;
    }

    if (data && (data.lyrics || data.syncedLyrics)) {
      const lyricsContent = data.syncedLyrics || data.lyrics;
      console.log(`[Lyrics] Successfully fetched for: ${title}`);

      // 3. Save the fetched lyrics to the database
      const { error: insertError } = await supabase
        .from('lyrics')
        .insert({
          song_id: songId,
          content: lyricsContent
        });

      if (insertError) {
        console.error(`[Lyrics] Error saving lyrics for "${title}":`, insertError);
      } else {
        console.log(`[Lyrics] Successfully saved to cache for: ${title}`);
        toast.success(`Paroles pour "${title}" sauvegardées.`);
      }
    } else {
      console.log(`[Lyrics] No lyrics found for: ${title}`);
    }
  } catch (error) {
    console.error('[Lyrics] Unexpected error in fetchLyricsInBackground:', error);
  }
};