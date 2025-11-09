import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Define CORS headers directly in the function file
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
    headers: {
      Authorization: `Bearer ${GENIUS_API_KEY}`,
    },
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
  return lyricsContent
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

serve(async (req) => {
  console.log("--- New generate-lyrics request ---");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SongDetails = await req.json();
    console.log("1. Received request body:", body);
    
    const { 
      songTitle, 
      artist, 
      duration, 
      albumName,
      imageUrl,
      filePath,
      tidalId,
      deezerId
    } = body;
    
    if (!songTitle || !artist) {
      console.error("Validation failed: songTitle and artist are required.");
      return new Response(JSON.stringify({ error: "songTitle and artist are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );
    console.log("2. Supabase client initialized with service role.");

    // 3. Try to find the song
    console.log(`3. Searching for song in DB: "${songTitle}" by "${artist}"`);
    let { data: songData, error: songSearchError } = await supabase
      .from("songs")
      .select("id")
      .eq("title", songTitle)
      .eq("artist", artist)
      .maybeSingle();

    if (songSearchError) {
      console.error("DB Error during song search:", songSearchError);
      throw new Error(`Database error while searching for song: ${songSearchError.message}`);
    }

    let songId: string;

    // 4. If song doesn't exist, create it
    if (!songData) {
      console.log(`4. Song not found. Creating new song entry...`);
      const { data: newSong, error: insertError } = await supabase
        .from("songs")
        .insert({
          title: songTitle,
          artist: artist,
          album_name: albumName,
          duration: duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : undefined,
          image_url: imageUrl,
          file_path: filePath || `tidal:${tidalId || deezerId}`,
          tidal_id: tidalId,
          deezer_id: deezerId,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("DB Error creating new song:", insertError);
        throw new Error("Failed to create a new entry for the song in the database.");
      }
      
      songId = newSong.id;
      console.log(`   - New song created with ID: ${songId}`);
    } else {
      songId = songData.id;
      console.log(`4. Song found in DB with ID: ${songId}`);
    }

    // 5. Check if lyrics already exist for this song ID
    console.log(`5. Checking for existing lyrics for song_id: ${songId}`);
    const { data: existingLyrics } = await supabase
      .from("lyrics")
      .select("id")
      .eq("song_id", songId)
      .maybeSingle();

    if (existingLyrics) {
      console.log("   - Lyrics already exist. Exiting function.");
      return new Response(JSON.stringify({ message: "Lyrics already exist for this song." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Fetch lyrics from Genius
    console.log("6. No existing lyrics. Fetching from Genius...");
    const hits = await searchSongOnGenius(`${songTitle} ${artist}`);
    if (hits.length === 0) {
      console.warn("   - Song not found on Genius.");
      return new Response(JSON.stringify({ error: "Song not found on Genius" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const songPath = hits[0].result.path;
    const lyrics = await getLyricsFromGenius(songPath);

    if (!lyrics) {
      console.error("   - Could not extract lyrics from Genius page.");
      return new Response(JSON.stringify({ error: "Could not extract lyrics from Genius page" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Save lyrics to the database
    console.log(`7. Saving lyrics to DB for song_id: ${songId}`);
    const { error: lyricsInsertError } = await supabase
      .from("lyrics")
      .insert({ song_id: songId, content: lyrics });

    if (lyricsInsertError) {
      console.error("DB Error saving lyrics:", lyricsInsertError);
      throw new Error("Failed to save lyrics to the database.");
    }

    console.log("8. Lyrics saved successfully. Returning lyrics to client.");

    return new Response(JSON.stringify({ lyrics }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("!!! Unhandled error in generate-lyrics function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});