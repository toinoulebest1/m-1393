// Supabase Edge Function: flacdownloader-proxy
// Proxies flacdownloader.com to bypass CORS and preserve Range requests for audio streaming

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    // Build share link
    const shareLink = share ?? (deezerId ? `https://www.deezer.com/track/${encodeURIComponent(deezerId)}` : null);
    if (!shareLink) {
      console.log('❌ Missing share or deezerId parameter');
      return new Response('Missing share or deezerId parameter', { status: 400, headers: corsHeaders });
    }

    const target = `https://flacdownloader.com/flac/download?t=${encodeURIComponent(shareLink)}&f=FLAC`;
    console.log(`🎯 Proxying request for deezerId: ${deezerId}`);
    console.log(`🔗 Target URL: ${target}`);

    // Forward Range header for seek support with realistic browser headers
    const headers: HeadersInit = {
      'accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
      'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'accept-encoding': 'identity',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'referer': 'https://www.deezer.com/',
      'origin': 'https://www.deezer.com',
      'sec-fetch-dest': 'audio',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
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
    const respType = upstream.headers.get('content-type') || '';
    const respLen = upstream.headers.get('content-length') || 'unknown';
    console.log(`📦 Content-Type: ${respType}`);
    console.log(`📏 Content-Length: ${respLen}`);
    
    // Si erreur HTTP explicite ou réponse non-audio
    if (upstream.status >= 400) {
      const errorText = await upstream.text();
      console.log(`❌ Upstream HTTP error ${upstream.status}:`, errorText.substring(0, 500));
      
      // Donner un message plus explicite selon l'erreur
      let errorMsg = 'Service temporairement indisponible';
      if (upstream.status === 429) errorMsg = 'Trop de requêtes, réessayez plus tard';
      else if (upstream.status === 403) errorMsg = 'Accès refusé par le service';
      else if (upstream.status === 500) errorMsg = 'Service surchargé, réessayez dans quelques secondes';
      else if (upstream.status === 404) errorMsg = 'Musique introuvable sur le service';
      
      return new Response(JSON.stringify({ 
        error: errorMsg,
        details: `HTTP ${upstream.status}`,
        deezerId 
      }), { 
        status: 503, // Service Unavailable au lieu du status upstream
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Bloquer les réponses non audio (ex: HTML challenge, JSON d'erreur)
    if (!(respType.toLowerCase().startsWith('audio/') || respType.toLowerCase().includes('octet-stream'))) {
      let snippet = '';
      try { snippet = (await upstream.text()).slice(0, 500); } catch {}
      console.log('❌ Non-audio response from upstream:', respType, snippet);
      return new Response(`Upstream content-type not audio (${respType})`, { status: 502, headers: corsHeaders });
    }

    // Prepare response headers, forwarding media-related ones
    const outHeaders = new Headers(corsHeaders);
    const passThroughHeaders = [
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
      'etag',
      'last-modified',
    ];

    for (const h of passThroughHeaders) {
      const v = upstream.headers.get(h);
      if (v) outHeaders.set(h, v);
    }

    // ✅ Forcer le bon Content-Type pour le lecteur audio
    outHeaders.set('content-type', 'audio/flac');
    
    // ✅ Forcer inline pour éviter le téléchargement
    outHeaders.set('content-disposition', 'inline');
    
    // Default sensible headers if missing
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