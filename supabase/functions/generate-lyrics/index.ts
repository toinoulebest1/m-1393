import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GENIUS_API_KEY = Deno.env.get("GENIUS_API_KEY");
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

async function searchSongOnGenius(query: string) {
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${GENIUS_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Genius API search failed: ${response.statusText}`);
  const data = await response.json();
  return data.response.hits;
}

async function getLyricsFromGenius(songPath: string) {
  const url = `https://api.genius.com${songPath}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch lyrics page: ${response.statusText}`);
  const html = await response.text();
  const lyricsRegex = /<div data-lyrics-container="true".*?>([\s\S]*?)<\/div>/g;
  let lyricsContent = "";
  let match;
  while ((match = lyricsRegex.exec(html)) !== null) {
    lyricsContent += match[1];
  }
  if (!lyricsContent) return null;
  return lyricsContent.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim();
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

  const hits = await searchSongOnGenius(`${songTitle} ${artist}`);
  if (hits.length === 0) return null;

  const songPath = hits[0].result.path;
  const lyrics = await getLyricsFromGenius(songPath);
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