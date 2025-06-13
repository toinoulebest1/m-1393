
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
      console.error('Invalid HTTP method:', req.method);
      return new Response(JSON.stringify({ 
        error: 'Method not allowed',
        details: 'Only POST requests are accepted'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 405
      });
    }

    // Parse the request body
    const body: RefreshTokenRequest = await req.json();
    const { refreshToken, clientId } = body;

    console.log('Token refresh request received for clientId:', clientId);

    // Check if all required parameters are provided
    if (!refreshToken) {
      console.error('Missing refresh token');
      return new Response(JSON.stringify({ 
        error: 'Missing refresh token',
        details: 'Le jeton de rafraîchissement est requis'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (!clientId) {
      console.error('Missing client ID');
      return new Response(JSON.stringify({ 
        error: 'Missing client ID',
        details: 'Le Client ID Microsoft est requis'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Get the client secret from environment variables
    const clientSecret = Deno.env.get('ONEDRIVE_CLIENT_SECRET');
    
    if (!clientSecret) {
      console.error('ONEDRIVE_CLIENT_SECRET environment variable not configured');
      return new Response(JSON.stringify({ 
        error: 'Client secret not configured',
        details: 'Le secret client OneDrive n\'est pas configuré sur le serveur. Contactez l\'administrateur.'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log('Attempting token refresh with Microsoft...');

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

    console.log('Microsoft response status:', tokenResponse.status);

    // Check if the token refresh was successful
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Microsoft token refresh error:', errorData);
      
      let userFriendlyMessage = 'Échec du rafraîchissement du jeton';
      
      try {
        const errorJson = JSON.parse(errorData);
        if (errorJson.error === 'invalid_client') {
          userFriendlyMessage = 'Client ID ou secret client invalide. Vérifiez votre configuration Azure.';
        } else if (errorJson.error === 'invalid_grant') {
          userFriendlyMessage = 'Jeton de rafraîchissement expiré ou invalide. Reconnectez-vous via OAuth.';
        } else if (errorJson.error_description) {
          userFriendlyMessage = `Erreur Microsoft: ${errorJson.error_description}`;
        }
      } catch (parseError) {
        console.error('Could not parse Microsoft error response:', parseError);
      }
      
      return new Response(JSON.stringify({ 
        error: userFriendlyMessage,
        details: errorData,
        microsoftError: true
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Parse the token response
    const tokenData = await tokenResponse.json();
    console.log('Token refresh successful');

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
      error: 'Erreur interne du serveur',
      details: error.message,
      suggestion: 'Vérifiez votre connexion internet et réessayez'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
