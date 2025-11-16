import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_RESPONSE_TIMEOUT = 8000; // 8 secondes

interface SongDetails {
  songTitle: string;
  artist: string;
  duration?: number;
  albumName?: string;
  imageUrl?: string;
  filePath?: string;
  tidalId?: string;
  deezerId?: string;
}

async function fetchLyricsFromLrclib(artist: string, title: string): Promise<string | null> {
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      return data.syncedLyrics || data.plainLyrics || null;
    }
  } catch (error) {
    console.error('[generate-lyrics] Error fetching from lrclib:', error);
  }
  return null;
}

async function fetchLyricsFromTidal(tidalId: string): Promise<string | null> {
  try {
    const url = `https://tidal.kinoplus.online/lyrics/?id=${tidalId}`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      const lyricsInfo = Array.isArray(data) ? data[0] : data;
      return lyricsInfo?.subtitles || lyricsInfo?.lyrics || null;
    }
  } catch (error) {
    console.error('[generate-lyrics] Error fetching from Tidal:', error);
  }
  return null;
}

async function getAndSaveLyrics(supabase: any, body: SongDetails): Promise<string | null> {
  const { songTitle, artist, duration, albumName, imageUrl, filePath, tidalId, deezerId } = body;

  let { data: songData } = await supabase
    .from("songs").select("id").eq("title", songTitle).eq("artist", artist).maybeSingle();

  let songId: string;
  if (!songData) {
    const { data: newSong, error: insertError } = await supabase
      .from("songs")
      .insert({
        title: songTitle, artist, album_name: albumName,
        duration: duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : undefined,
        image_url: imageUrl, file_path: filePath || `tidal:${tidalId || deezerId}`,
        tidal_id: tidalId, deezer_id: deezerId,
      }).select("id").single();
    if (insertError) throw new Error("Failed to create new song entry.");
    songId = newSong.id;
  } else {
    songId = songData.id;
  }

  let lyrics: string | null = null;

  // 1. Try lrclib first
  if (artist && songTitle) {
    lyrics = await fetchLyricsFromLrclib(artist, songTitle);
    if (lyrics) console.log('[generate-lyrics] Found lyrics from lrclib');
  }

  // 2. Try Tidal if we have a Tidal ID
  if (!lyrics && tidalId) {
    lyrics = await fetchLyricsFromTidal(tidalId);
    if (lyrics) console.log('[generate-lyrics] Found lyrics from Tidal');
  }

  if (!lyrics) return null;

  await supabase.from("lyrics").upsert({ song_id: songId, content: lyrics }, { onConflict: 'song_id' });

  return lyrics;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SongDetails = await req.json();
    const { songTitle, artist } = body;
    if (!songTitle || !artist) {
      return new Response(JSON.stringify({ error: "songTitle and artist are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Check if lyrics already exist
    const { data: song } = await supabase.from("songs").select("id").eq("title", songTitle).eq("artist", artist).maybeSingle();
    if (song) {
      const { data: existingLyrics } = await supabase.from("lyrics").select("content").eq("song_id", song.id).maybeSingle();
      if (existingLyrics) {
        return new Response(JSON.stringify({ lyrics: existingLyrics.content }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Race between fetching lyrics and a timeout
    const lyricsPromise = getAndSaveLyrics(supabase, body);
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), FUNCTION_RESPONSE_TIMEOUT)
    );

    try {
      const lyrics = await Promise.race([lyricsPromise, timeoutPromise]);
      if (lyrics) {
        // Success within timeout
        return new Response(JSON.stringify({ lyrics }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Found no lyrics, but process finished
        return new Response(JSON.stringify({ message: "No lyrics found." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (error) {
      if (error.message === "Timeout") {
        // Timeout occurred, respond with 202 and let it finish in background
        return new Response(JSON.stringify({ message: "Lyric generation is taking longer than expected and will continue in the background." }), {
          status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Other error during lyric fetching
      throw error;
    }
  } catch (error) {
    console.error("!!! Unhandled error in generate-lyrics function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});