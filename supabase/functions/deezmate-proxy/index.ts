// Supabase Edge Function: deezmate-proxy
// Proxies api.deezmate.com to bypass CORS, handles the two-step fetch, and preserves Range requests for audio streaming

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

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  if (!deezerId) {
    console.log('❌ Missing deezerId parameter');
    return new Response('Missing deezerId parameter', { status: 400, headers: corsHeaders });
  }

  try {
    // Step 1: Get the JSON from deezmate API containing the audio link
    const deezmateApiUrl = `https://api.deezmate.com/dl/${encodeURIComponent(deezerId)}`;
    console.log(`🎯 Step 1: Fetching metadata from Deezmate for deezerId: ${deezerId}`);
    
    const deezmateResponse = await fetch(deezmateApiUrl, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      }
    });

    if (!deezmateResponse.ok) {
      const errorText = await deezmateResponse.text();
      console.log(`❌ Deezmate API error ${deezmateResponse.status}:`, errorText.substring(0, 500));
      return new Response(JSON.stringify({ error: 'Deezmate API returned an error' }), { 
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const deezmateData = await deezmateResponse.json();
    const audioUrl = deezmateData.url || deezmateData.link || deezmateData.flac;

    if (!audioUrl || typeof audioUrl !== 'string') {
      console.error('❌ Could not find audio URL in Deezmate response:', JSON.stringify(deezmateData));
      return new Response('Could not find audio URL in Deezmate response', { status: 502, headers: corsHeaders });
    }

    console.log(`🎧 Step 2: Found audio URL. Proxying from: ${audioUrl}`);

    // Step 2: Fetch the actual audio file and stream it back to the client
    const audioHeaders: HeadersInit = {
      'accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };
    const range = req.headers.get('range');
    if (range) {
      audioHeaders['range'] = range;
      console.log(`📊 Forwarding Range request: ${range}`);
    }

    const upstreamResponse = await fetch(audioUrl, {
      method: 'GET',
      headers: audioHeaders,
      redirect: 'follow',
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      console.log(`❌ Upstream audio fetch error ${upstreamResponse.status}:`, errorText.substring(0, 500));
      return new Response(`Upstream audio fetch error: ${upstreamResponse.statusText}`, { status: upstreamResponse.status, headers: corsHeaders });
    }

    const upstreamContentType = upstreamResponse.headers.get('content-type') || '';
    if (!upstreamContentType.startsWith('audio/') && !upstreamContentType.includes('octet-stream')) {
      console.log('❌ Non-audio response from upstream audio URL:', upstreamContentType);
      return new Response(`Upstream content-type not audio (${upstreamContentType})`, { status: 502, headers: corsHeaders });
    }

    // Stream the response back to the client
    const outputHeaders = new Headers(corsHeaders);
    const passThroughHeaders = ['content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified'];

    upstreamResponse.headers.forEach((value, key) => {
      if (passThroughHeaders.includes(key.toLowerCase())) {
        outputHeaders.set(key, value);
      }
    });

    outputHeaders.set('content-type', upstreamContentType || 'audio/flac');
    outputHeaders.set('content-disposition', 'inline');
    if (!outputHeaders.has('accept-ranges')) outputHeaders.set('accept-ranges', 'bytes');
    if (!outputHeaders.has('cache-control')) outputHeaders.set('cache-control', 'private, max-age=3600');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: outputHeaders,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('🔥 Proxy error:', msg);
    return new Response(`Proxy error: ${msg}`, { status: 502, headers: corsHeaders });
  }
});