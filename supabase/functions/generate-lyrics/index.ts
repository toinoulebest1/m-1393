import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GENIUS_API_KEY = Deno.env.get("GENIUS_API_KEY");

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
  console.log(`[Genius] Searching for: "${query}"`);
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${GENIUS_API_KEY}` },
  });
  if (!response.ok) {
    console.error(`[Genius] API search failed with status: ${response.status}`);
    throw new Error(`Genius API search failed: ${response.statusText}`);
  }
  const data = await response.json();
  console.log(`[Genius] Found ${data.response.hits.length} hits.`);
  return data.response.hits;
}

async function getLyricsFromGenius(songPath: string) {
  console.log(`[Genius] Fetching lyrics from path: ${songPath}`);
  const url = `https://api.genius.com${songPath}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`[Genius] Failed to fetch lyrics page with status: ${response.status}`);
    throw new Error(`Failed to fetch lyrics page: ${response.statusText}`);
  }
  const html = await response.text();
  const lyricsRegex = /<div data-lyrics-container="true".*?>([\s\S]*?)<\/div>/g;
  let lyricsContent = "";
  let match;
  while ((match = lyricsRegex.exec(html)) !== null) {
    lyricsContent += match[1];
  }
  if (!lyricsContent) {
    console.warn("[Genius] Could not extract lyrics content from HTML.");
    return null;
  }
  console.log("[Genius] Successfully extracted lyrics content.");
  return lyricsContent.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim();
}

serve(async (req) => {
  console.log("--- New generate-lyrics request ---");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const handleAsyncLyricGeneration = async (body: SongDetails) => {
    try {
      const { songTitle, artist, duration, albumName, imageUrl, filePath, tidalId, deezerId } = body;
      
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } }
      );
      console.log("2. [Async] Supabase client initialized.");

      let { data: songData, error: songSearchError } = await supabase
        .from("songs").select("id").eq("title", songTitle).eq("artist", artist).maybeSingle();

      if (songSearchError) throw new Error(`DB error searching for song: ${songSearchError.message}`);

      let songId: string;
      if (!songData) {
        console.log(`3. [Async] Song not found. Creating...`);
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
        console.log(`   - New song created with ID: ${songId}`);
      } else {
        songId = songData.id;
        console.log(`3. [Async] Song found with ID: ${songId}`);
      }

      console.log(`4. [Async] Fetching from Genius...`);
      const hits = await searchSongOnGenius(`${songTitle} ${artist}`);
      if (hits.length === 0) {
        console.warn("   - Song not found on Genius.");
        return; // End of process
      }

      const songPath = hits[0].result.path;
      const lyrics = await getLyricsFromGenius(songPath);
      if (!lyrics) {
        console.error("   - Could not extract lyrics from Genius page.");
        return; // End of process
      }

      console.log(`5. [Async] Saving lyrics to DB for song_id: ${songId}`);
      const { error: lyricsInsertError } = await supabase
        .from("lyrics").insert({ song_id: songId, content: lyrics });

      if (lyricsInsertError) {
        console.error("DB Error saving lyrics:", lyricsInsertError);
      } else {
        console.log("6. [Async] Lyrics saved successfully!");
      }
    } catch (error) {
      console.error("!!! Unhandled error in async lyric generation:", error);
    }
  };

  try {
    const body: SongDetails = await req.json();
    console.log("1. Received request body:", body);
    
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

    let { data: songData } = await supabase
      .from("songs").select("id").eq("title", songTitle).eq("artist", artist).maybeSingle();
    
    if (songData) {
      const { data: existingLyrics } = await supabase
        .from("lyrics").select("id").eq("song_id", songData.id).maybeSingle();
      if (existingLyrics) {
        console.log("   - Lyrics already exist. Exiting.");
        return new Response(JSON.stringify({ message: "Lyrics already exist for this song." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Don't await this call. This lets the function run in the background.
    handleAsyncLyricGeneration(body);

    console.log("2. Accepted request. Generation will continue in background.");
    return new Response(JSON.stringify({ message: "Lyric generation started." }), {
      status: 202, // Accepted
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("!!! Unhandled error in generate-lyrics function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});