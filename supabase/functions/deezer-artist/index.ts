
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
    const { artistId, artistName } = await req.json();
    
    if (!artistId && !artistName) {
      return new Response(
        JSON.stringify({ error: "Artist ID or name parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let url = '';
    
    // Search by direct artist ID
    if (artistId) {
      console.log("Fetching Deezer artist by ID:", artistId);
      url = `https://api.deezer.com/artist/${artistId}`;
    }
    // Search by artist name
    else if (artistName) {
      console.log("Searching Deezer for artist:", artistName);
      // First search for the artist to get their ID
      const searchUrl = `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=1`;
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) {
        throw new Error(`Deezer API search error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.data || searchData.data.length === 0) {
        return new Response(
          JSON.stringify({ error: "Artist not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Use the first result's ID
      const artist = searchData.data[0];
      url = `https://api.deezer.com/artist/${artist.id}`;
    }
    
    // Fetch artist details
    const artistResponse = await fetch(url);
    
    if (!artistResponse.ok) {
      throw new Error(`Deezer API artist error: ${artistResponse.status}`);
    }

    const artistData = await artistResponse.json();
    
    // Get artist's top tracks
    const topTracksUrl = `${url}/top?limit=5`;
    const topTracksResponse = await fetch(topTracksUrl);
    let topTracks = [];
    
    if (topTracksResponse.ok) {
      const topTracksData = await topTracksResponse.json();
      topTracks = topTracksData.data || [];
    }
    
    // Get artist's albums
    const albumsUrl = `${url}/albums?limit=10`;
    const albumsResponse = await fetch(albumsUrl);
    let albums = [];
    
    if (albumsResponse.ok) {
      const albumsData = await albumsResponse.json();
      albums = albumsData.data || [];
    }
    
    // Combine all data
    const result = {
      artist: artistData,
      topTracks,
      albums
    };
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in Deezer artist function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
