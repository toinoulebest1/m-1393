import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QOBUZ_API_BASE = 'https://dabmusic.xyz/api';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint'); // 'search' or 'stream'
    
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing endpoint parameter' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let qobuzUrl: string;
    
    if (endpoint === 'search') {
      const query = url.searchParams.get('q');
      const offset = url.searchParams.get('offset') || '0';
      const type = url.searchParams.get('type') || 'track';
      
      if (!query) {
        return new Response(
          JSON.stringify({ error: 'Missing query parameter' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      qobuzUrl = `${QOBUZ_API_BASE}/search?q=${encodeURIComponent(query)}&offset=${offset}&type=${type}`;
    } else if (endpoint === 'stream') {
      const trackId = url.searchParams.get('trackId');
      
      if (!trackId) {
        return new Response(
          JSON.stringify({ error: 'Missing trackId parameter' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      qobuzUrl = `${QOBUZ_API_BASE}/stream?trackId=${trackId}`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[QobuzProxy] Fetching from: ${qobuzUrl}`);

    // Retry avec backoff + rotation d'User-Agent pour contourner 403/429
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
    ];

    const doFetch = async (attempt: number) => {
      const qobuzToken = Deno.env.get('QOBUZ_API_TOKEN');

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (qobuzToken) {
        headers['Cookie'] = `session=${qobuzToken}`;
      }

      console.log(`[QobuzProxy] Attempt ${attempt + 1} with session cookie`, { hasCookie: !!qobuzToken });
      return await fetch(qobuzUrl, { headers, redirect: 'follow' as RequestRedirect });
    };

    let response: Response | null = null;
    let lastStatus = 0;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const jitter = Math.floor(150 + Math.random() * 350);
        const backoff = attempt * 250 + jitter; // 150-600ms environ
        await new Promise((r) => setTimeout(r, backoff));
      }
      response = await doFetch(attempt);
      lastStatus = response.status;
      const debugHeaders = ['server','cf-ray','content-type','x-content-type-options','x-frame-options','strict-transport-security'];
      const picked: Record<string, string> = {};
      for (const h of debugHeaders) {
        const v = response.headers.get(h);
        if (v) picked[h] = v;
      }
      console.log(`[QobuzProxy] Attempt ${attempt + 1} -> Status: ${response.status}`, picked);
      if (response.ok) break;
      if (![403, 429].includes(response.status)) break; // ne retente pas pour autres codes
      console.warn(`[QobuzProxy] Attempt ${attempt + 1}/${maxAttempts} failed with ${response.status}. Retrying...`);
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 500;
      const statusText = response ? response.statusText : 'No response';
      let bodySnippet = '';
      try {
        if (response) {
          const text = await response.text();
          bodySnippet = text.slice(0, 500);
        }
      } catch (_) {}
      const debugHeaders = response ? Object.fromEntries(Array.from(response.headers.entries()).slice(0, 20)) : {};
      console.error(`[QobuzProxy] Error detailed: ${status} ${statusText} Body: ${bodySnippet}`);
      console.log('[QobuzProxy] Response headers snapshot:', debugHeaders);
      return new Response(
        JSON.stringify({ error: `Qobuz API error: ${status}`, statusText, bodySnippet }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('[QobuzProxy] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
