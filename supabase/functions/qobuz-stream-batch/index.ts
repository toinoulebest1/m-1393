import CryptoJS from "npm:crypto-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QOBUZ_API_BASE = 'https://www.qobuz.com/api.json/0.2';

interface BatchResult {
  trackId: string;
  url?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { track_ids, quality = '27' } = await req.json();
    
    if (!track_ids || !Array.isArray(track_ids) || track_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'track_ids array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appId = Deno.env.get('QOBUZ_APP_ID');
    const appSecret = Deno.env.get('QOBUZ_APP_SECRET');
    const userToken = Deno.env.get('QOBUZ_API_TOKEN') || Deno.env.get('QOBUZ_USER_TOKEN');

    if (!appId || !appSecret || !userToken) {
      console.error('[QobuzStreamBatch] Missing credentials');
      return new Response(
        JSON.stringify({ error: 'Missing Qobuz credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[QobuzStreamBatch] Processing ${track_ids.length} tracks`);

    // Traiter tous les tracks en parallèle pour vitesse maximale
    const results = await Promise.allSettled(
      track_ids.map(async (trackId: string): Promise<BatchResult> => {
        try {
          const requestTs = Math.floor(Date.now() / 1000);
          const sigString = `trackgetFileUrlformat_id${quality}intentstreamtrack_id${trackId}${requestTs}${appSecret}`;
          const signature = CryptoJS.MD5(sigString).toString();

          const qobuzUrl = `${QOBUZ_API_BASE}/track/getFileUrl?app_id=${appId}&track_id=${trackId}&format_id=${quality}&request_ts=${requestTs}&request_sig=${signature}&intent=stream&user_auth_token=${userToken}`;
          
          const qobuzResponse = await fetch(qobuzUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });

          if (!qobuzResponse.ok) {
            const errorText = await qobuzResponse.text();
            console.error(`[QobuzStreamBatch] Failed track ${trackId}: ${errorText}`);
            return { trackId, error: `HTTP ${qobuzResponse.status}` };
          }

          const qobuzData = await qobuzResponse.json();
          
          if (!qobuzData.url) {
            return { trackId, error: 'No URL in response' };
          }

          return { trackId, url: qobuzData.url };
        } catch (error) {
          console.error(`[QobuzStreamBatch] Error for track ${trackId}:`, error);
          return { trackId, error: String(error) };
        }
      })
    );

    // Convertir les résultats en format simple
    const batchResults: BatchResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { trackId: track_ids[index], error: result.reason };
      }
    });

    const successCount = batchResults.filter(r => r.url).length;
    console.log(`[QobuzStreamBatch] Success: ${successCount}/${track_ids.length}`);

    return new Response(
      JSON.stringify({ 
        results: batchResults,
        success_count: successCount,
        total: track_ids.length
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=3000'
        }
      }
    );

  } catch (error) {
    console.error('[QobuzStreamBatch] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
