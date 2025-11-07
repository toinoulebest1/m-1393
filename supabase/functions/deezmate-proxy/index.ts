// Supabase Edge Function: deezmate-proxy
// Proxies api.deezmate.com to bypass CORS and handle API logic centrally.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let trackId: string | null = null;

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      trackId = body.trackId;
    } else { // Fallback to GET
      const url = new URL(req.url);
      trackId = url.searchParams.get('trackId');
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!trackId) {
    return new Response(JSON.stringify({ error: 'Missing trackId parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = `https://api.deezmate.com/dl/${trackId}`;
  console.log(`🎯 [Deezmate Proxy] Fetching for trackId: ${trackId}`);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'm-1393/1.0',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ [Deezmate Proxy] Upstream error ${response.status}:`, errorBody);
      return new Response(JSON.stringify({ error: `Upstream service failed with status ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // Forward the successful response
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`❌ [Deezmate Proxy] Proxy error:`, msg);
    return new Response(JSON.stringify({ error: `Proxy error: ${msg}` }), {
      status: 502, // Bad Gateway
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});