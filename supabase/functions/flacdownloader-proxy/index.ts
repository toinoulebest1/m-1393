// Supabase Edge Function: flacdownloader-proxy
// Proxies flacdownloader.com to bypass CORS and preserve Range requests for audio streaming

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const deezerId = url.searchParams.get('deezerId');
  const share = url.searchParams.get('share');

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Build share link
    const shareLink = share ?? (deezerId ? `https://www.deezer.com/track/${encodeURIComponent(deezerId)}` : null);
    if (!shareLink) {
      console.log('❌ Missing share or deezerId parameter');
      return new Response('Missing share or deezerId parameter', { status: 400, headers: corsHeaders });
    }

    const target = `https://flacdownloader.com/flac/download?t=${encodeURIComponent(shareLink)}&f=FLAC`;
    console.log(`🎯 Proxying request for deezerId: ${deezerId}`);
    console.log(`🔗 Target URL: ${target}`);

    // Forward Range header for seek support
    const headers: HeadersInit = {
      'accept': '*/*',
      'user-agent': req.headers.get('user-agent') ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'referer': 'https://www.deezer.com/',
    };

    const range = req.headers.get('range');
    if (range) {
      headers['range'] = range;
      console.log(`📊 Range request: ${range}`);
    }

    console.log('🚀 Fetching from flacdownloader.com...');
    const upstream = await fetch(target, {
      method: 'GET',
      headers,
      redirect: 'follow',
    });

    console.log(`📡 Response status: ${upstream.status} ${upstream.statusText}`);
    console.log(`📦 Content-Type: ${upstream.headers.get('content-type')}`);
    console.log(`📏 Content-Length: ${upstream.headers.get('content-length')}`);
    
    // Si erreur, logger le body
    if (upstream.status >= 400) {
      const errorText = await upstream.text();
      console.log(`❌ Error response body: ${errorText.substring(0, 500)}`);
      return new Response(`Upstream error: ${upstream.status} - ${errorText.substring(0, 200)}`, { 
        status: upstream.status, 
        headers: corsHeaders 
      });
    }

    // Prepare response headers, forwarding media-related ones
    const outHeaders = new Headers(corsHeaders);
    const passThroughHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'content-disposition',
      'cache-control',
      'etag',
      'last-modified',
    ];

    for (const h of passThroughHeaders) {
      const v = upstream.headers.get(h);
      if (v) outHeaders.set(h, v);
    }

    // Default sensible headers if missing
    if (!outHeaders.get('content-type')) outHeaders.set('content-type', 'audio/flac');
    if (!outHeaders.get('accept-ranges')) outHeaders.set('accept-ranges', 'bytes');
    if (!outHeaders.get('cache-control')) outHeaders.set('cache-control', 'private, max-age=60');

    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Proxy error: ${msg}`, { status: 502, headers: corsHeaders });
  }
});
