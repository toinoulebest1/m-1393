// Supabase Edge Function: flacdownloader-proxy
// Proxies flacdownloader.com to bypass CORS and correctly handle Range requests for audio seeking.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  // Expose headers required for audio players to read partial content responses
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let deezerId: string | null = null;
  let share: string | null = null;

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      deezerId = body.deezerId;
      share = body.share;
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      deezerId = url.searchParams.get('deezerId');
      share = url.searchParams.get('share');
    } else {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }
  } catch (e) {
    return new Response('Invalid request', { status: 400, headers: corsHeaders });
  }

  try {
    const shareLink = share ?? (deezerId ? `https://www.deezer.com/track/${encodeURIComponent(deezerId)}` : null);
    if (!shareLink) {
      return new Response('Missing share or deezerId parameter', { status: 400, headers: corsHeaders });
    }

    const target = `https://flacdownloader.com/flac/download?t=${encodeURIComponent(shareLink)}&f=FLAC`;
    console.log(`🎯 Proxying request for deezerId: ${deezerId}`);

    // Forward Range header for seek support
    const headers: HeadersInit = {
      'accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'referer': 'https://www.deezer.com/',
    };
    const range = req.headers.get('range');
    if (range) {
      headers['range'] = range;
      console.log(`📊 Range request: ${range}`);
    }

    const upstream = await fetch(target, {
      method: 'GET',
      headers,
      redirect: 'follow',
    });

    console.log(`📡 Upstream Response: ${upstream.status} ${upstream.statusText}`);

    if (upstream.status >= 400) {
      const errorText = await upstream.text();
      console.log(`❌ Upstream HTTP error ${upstream.status}:`, errorText.substring(0, 200));
      return new Response(JSON.stringify({ error: `Service unavailable (HTTP ${upstream.status})` }), { 
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prepare response headers, forwarding all relevant media headers
    const outHeaders = new Headers(corsHeaders);
    const passThroughHeaders = [
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
      'etag',
      'last-modified',
      'content-type',
      'content-disposition',
    ];

    for (const h of passThroughHeaders) {
      const v = upstream.headers.get(h);
      if (v) outHeaders.set(h, v);
    }
    
    // Ensure correct content type if missing
    if (!outHeaders.has('content-type')) {
      outHeaders.set('content-type', 'audio/flac');
    }

    // Return the upstream response (body, status, headers) directly to the client
    return new Response(upstream.body, {
      status: upstream.status, // This will be 206 for successful range requests
      headers: outHeaders,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Proxy error: ${msg}`, { status: 502, headers: corsHeaders });
  }
});