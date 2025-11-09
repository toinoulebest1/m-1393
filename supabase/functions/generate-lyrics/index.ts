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
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GENIUS_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Genius API search failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response.hits;
}

async function getLyricsFromGenius(songPath: string) {
  const url = `https://api.genius.com${songPath}`;
  const response = await fetch(url);

  if (!response.ok) {
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
    return null;
  }

  return lyricsContent
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { 
      songTitle, 
      artist, 
      duration, 
      albumName,
      imageUrl,
      filePath,
      tidalId,
      deezerId
    }: SongDetails = await req.json();
    
    if (!songTitle || !artist) {
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

    // 1. Try to find the song
    let { data: songData } = await supabase
      .from("songs")
      .select("id")
      .eq("title", songTitle)
      .eq("artist", artist)
      .maybeSingle();

    let songId: string;

    // 2. If song doesn't exist, create it
    if (!songData) {
      console.log(`Song "${songTitle}" by "${artist}" not found. Creating it.`);
      const { data: newSong, error: insertError } = await supabase
        .from("songs")
        .insert({
          title: songTitle,
          artist: artist,
          album_name: albumName,
          duration: duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : undefined,
          image_url: imageUrl,
          file_path: filePath || `tidal:${tidalId || deezerId}`, // Fallback path
          tidal_id: tidalId,
          deezer_id: deezerId,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error creating new song:", insertError);
        throw new Error("Failed to create a new entry for the song in the database.");
      }
      
      songId = newSong.id;
      console.log(`New song created with ID: ${songId}`);
    } else {
      songId = songData.id;
    }

    // 3. Check if lyrics already exist for this song ID
    const { data: existingLyrics } = await supabase
      .from("lyrics")
      .select("id")
      .eq("song_id", songId)
      .maybeSingle();

    if (existingLyrics) {
      return new Response(JSON.stringify({ message: "Lyrics already exist for this song." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch lyrics from Genius
    const hits = await searchSongOnGenius(`${songTitle} ${artist}`);
    if (hits.length === 0) {
      return new Response(JSON.stringify({ error: "Song not found on Genius" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const songPath = hits[0].result.path;
    const lyrics = await getLyricsFromGenius(songPath);

    if (!lyrics) {
      return new Response(JSON.stringify({ error: "Could not extract lyrics from Genius page" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Save lyrics to the database
    const { error: lyricsInsertError } = await supabase
      .from("lyrics")
      .insert({ song_id: songId, content: lyrics });

    if (lyricsInsertError) {
      console.error("Error saving lyrics to Supabase:", lyricsInsertError);
      throw new Error("Failed to save lyrics to the database.");
    }

    console.log("Lyrics saved to Supabase successfully.");

    // Return lyrics immediately to the client
    return new Response(JSON.stringify({ lyrics }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-lyrics function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});