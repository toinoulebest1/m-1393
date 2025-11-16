import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
};

// Helper function to compute MD5 hash
function md5(message: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = crypto.subtle.digestSync("MD5", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const QOBUZ_API_BASE = 'https://www.qobuz.com/api.json/0.2';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const trackId = url.searchParams.get('track_id');
    const quality = url.searchParams.get('quality') || '27'; // Default: FLAC 24-bit
    
    if (!trackId) {
      return new Response(
        JSON.stringify({ error: 'Missing track_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get secrets
    const appId = Deno.env.get('QOBUZ_APP_ID');
    const appSecret = Deno.env.get('QOBUZ_APP_SECRET');
    const userToken = Deno.env.get('QOBUZ_API_TOKEN');

    if (!appId || !appSecret || !userToken) {
      console.error('[QobuzStream] Missing credentials');
      return new Response(
        JSON.stringify({ error: 'Missing Qobuz credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signature
    const requestTs = Math.floor(Date.now() / 1000);
    const sigString = `trackgetFileUrlformat_id${quality}intentstreamtrack_id${trackId}${requestTs}${appSecret}`;
    const signature = md5(sigString);

    console.log(`[QobuzStream] Getting audio URL for track ${trackId}`);

    // Get audio URL from Qobuz
    const qobuzUrl = `${QOBUZ_API_BASE}/track/getFileUrl?app_id=${appId}&track_id=${trackId}&format_id=${quality}&request_ts=${requestTs}&request_sig=${signature}&intent=stream&user_auth_token=${userToken}`;
    
    const qobuzResponse = await fetch(qobuzUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!qobuzResponse.ok) {
      const errorText = await qobuzResponse.text();
      console.error(`[QobuzStream] Qobuz API error: ${qobuzResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Failed to get stream URL', details: errorText }),
        { status: qobuzResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qobuzData = await qobuzResponse.json();
    
    if (!qobuzData.url) {
      console.error('[QobuzStream] No URL in Qobuz response');
      return new Response(
        JSON.stringify({ error: 'No audio URL returned from Qobuz' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioUrl = qobuzData.url;
    console.log(`[QobuzStream] Streaming audio from Qobuz for track ${trackId}`);

    // Get the Range header from client (for seeking)
    const rangeHeader = req.headers.get('range');
    const audioHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    if (rangeHeader) {
      audioHeaders['Range'] = rangeHeader;
    }

    // Fetch the audio file from Qobuz
    const audioResponse = await fetch(audioUrl, { headers: audioHeaders });

    if (!audioResponse.ok && audioResponse.status !== 206) {
      console.error(`[QobuzStream] Failed to fetch audio: ${audioResponse.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch audio from Qobuz' }),
        { status: audioResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build response headers
    const responseHeaders = new Headers(corsHeaders);
    
    // Copy important headers from Qobuz response
    const contentType = audioResponse.headers.get('content-type') || 'audio/flac';
    const contentLength = audioResponse.headers.get('content-length');
    const acceptRanges = audioResponse.headers.get('accept-ranges');
    const contentRange = audioResponse.headers.get('content-range');

    responseHeaders.set('Content-Type', contentType);
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    if (acceptRanges) responseHeaders.set('Accept-Ranges', acceptRanges);
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    // Cache headers
    responseHeaders.set('Cache-Control', 'public, max-age=31536000');

    // Return the audio stream with status 206 if partial content
    return new Response(audioResponse.body, {
      status: audioResponse.status === 206 ? 206 : 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('[QobuzStream] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
