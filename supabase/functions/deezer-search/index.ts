
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
    const { query, limit = 25, index = 0 } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Searching Deezer for:", query, "with limit:", limit, "index:", index);
    
    const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&index=${index}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`Deezer API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Deezer search results:", data.data?.length || 0, "tracks returned (", data.total, "total matches)");
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in Deezer search function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
