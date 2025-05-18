
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artistId } = await req.json();
    
    if (!artistId) {
      return new Response(
        JSON.stringify({ error: 'Artist ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Fetching Deezer artist data for ID: ${artistId}`);

    // Fetch artist data from Deezer API
    const artistResponse = await fetch(`https://api.deezer.com/artist/${artistId}`);
    
    if (!artistResponse.ok) {
      console.error(`Deezer API error: ${artistResponse.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch artist data from Deezer' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const artist = await artistResponse.json();
    
    // Fetch top tracks for this artist
    const tracksResponse = await fetch(`https://api.deezer.com/artist/${artistId}/top?limit=10`);
    let tracks = [];
    
    if (tracksResponse.ok) {
      const tracksData = await tracksResponse.json();
      tracks = tracksData.data || [];
    }

    // Return artist data and tracks
    return new Response(
      JSON.stringify({ artist, tracks }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error(`Error in deezer-artist function:`, error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
