
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Create a Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RequestBody {
  code: string;
  redirectUri: string;
  clientId: string;
}

serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      status: 204
    });
  }

  try {
    // Ensure the request is a POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 405
      });
    }

    // Parse the request body
    const body: RequestBody = await req.json();
    const { code, redirectUri, clientId } = body;

    // Check if all required parameters are provided
    if (!code || !redirectUri || !clientId) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Get the client secret from environment variables
    const clientSecret = Deno.env.get('ONEDRIVE_CLIENT_SECRET');
    
    if (!clientSecret) {
      return new Response(JSON.stringify({ error: 'Client secret not configured' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Exchange the code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    // Check if the token request was successful
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('OneDrive token error:', errorData);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to exchange code for token',
        details: errorData
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Parse the token response
    const tokenData = await tokenResponse.json();

    // Return the token data
    return new Response(JSON.stringify(tokenData), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
      status: 200
    });
  } catch (error) {
    // Log the error
    console.error('OneDrive token exchange error:', error);
    
    // Return an error response
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
