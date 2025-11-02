import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { endpoint, query, limit = 20 } = await req.json();
    
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Endpoint parameter is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let deezerUrl = `https://api.deezer.com${endpoint}`;
    
    // Ajouter les paramètres de query si nécessaire
    if (query) {
      deezerUrl += `?q=${encodeURIComponent(query)}&limit=${limit}`;
    }

    console.log('🔍 Proxying Deezer API call:', deezerUrl);

    const deezerResponse = await fetch(deezerUrl);
    const data = await deezerResponse.json();

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('❌ Deezer proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
