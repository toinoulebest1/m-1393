import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const GENIUS_API_KEY = Deno.env.get("GENIUS_API_KEY");

interface SongDetails {
  songTitle: string;
  artist: string;
  duration?: number;
  albumName?: string;
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
    const { songTitle, artist, duration, albumName }: SongDetails = await req.json();
    
    if (!songTitle || !artist) {
      return new Response(JSON.stringify({ error: "songTitle and artist are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: songData, error: songError } = await supabase
      .from("songs")
      .select("id")
      .eq("title", songTitle)
      .eq("artist", artist)
      .single();

    if (songError || !songData) {
      return new Response(JSON.stringify({ error: "Song not found in database" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const songId = songData.id;

    const { data: existingLyrics, error: lyricsCheckError } = await supabase
      .from("lyrics")
      .select("id")
      .eq("song_id", songId)
      .single();

    if (existingLyrics) {
      return new Response(JSON.stringify({ message: "Lyrics already exist for this song." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Save to DB in the background (don't await)
    supabase
      .from("lyrics")
      .insert({ song_id: songId, content: lyrics })
      .then(({ error }) => {
        if (error) {
          console.error("Error saving lyrics to Supabase:", error);
        } else {
          console.log("Lyrics saved to Supabase successfully.");
        }
      });

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