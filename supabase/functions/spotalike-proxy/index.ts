import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { method, endpoint, requestBody, sessionId, traceId, algorithm } = await req.json();

    console.log('[Spotalike Proxy] Request:', { method, endpoint, sessionId, traceId, requestBody, algorithm });

    const url = `https://api.spotalike.com${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'spotalike-session-id': sessionId,
      'spotalike-trace-id': traceId,
    };

    if (algorithm) {
      headers['spotalike-algorithm'] = algorithm;
    }

    const options: RequestInit = {
      method: method,
      headers: headers,
    };

    if (requestBody && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(requestBody);
      console.log('[Spotalike Proxy] Request body:', JSON.stringify(requestBody));
    }

    console.log('[Spotalike Proxy] Calling:', url);

    const response = await fetch(url, options);

    if (!response.ok) {
      console.error('[Spotalike Proxy] API error:', response.status, response.statusText);
      const text = await response.text();
      console.error('[Spotalike Proxy] Response:', text);
      
      return new Response(
        JSON.stringify({ error: `Spotalike API error: ${response.status}`, details: text }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('[Spotalike Proxy] Success, tracks count:', data?.tracks?.length || 0);

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[Spotalike Proxy] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
