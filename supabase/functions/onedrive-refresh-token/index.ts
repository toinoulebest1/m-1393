
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface RefreshTokenRequest {
  refreshToken: string;
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
    const body: RefreshTokenRequest = await req.json();
    const { refreshToken, clientId } = body;

    // Check if all required parameters are provided
    if (!refreshToken || !clientId) {
      return new Response(JSON.stringify({ error: 'Missing refresh token or client ID' }), {
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

    // Use the refresh token to get a new access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    // Check if the token refresh was successful
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('OneDrive token refresh error:', errorData);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to refresh access token',
        details: errorData
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Parse the token response
    const tokenData = await tokenResponse.json();

    // Return the new token data
    return new Response(JSON.stringify(tokenData), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
      status: 200
    });
  } catch (error) {
    // Log the error
    console.error('OneDrive token refresh error:', error);
    
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
