
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
  codeVerifier: string; // Added for PKCE support
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey'
};

serve(async (req) => {
  console.log(`[${new Date().toISOString()}] OneDrive token exchange request received`);
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, {
      headers: corsHeaders,
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      });
    }

    console.log('Parsing request body...');
    // Parse the request body
    const body: RequestBody = await req.json();
    const { code, redirectUri, clientId, codeVerifier } = body;

    console.log('Request body parsed successfully');
    console.log('Client ID:', clientId ? `${clientId.substring(0, 8)}...` : 'missing');
    console.log('Code:', code ? 'present' : 'missing');
    console.log('Redirect URI:', redirectUri);
    console.log('Code Verifier:', codeVerifier ? 'present' : 'missing');

    // Check if all required parameters are provided
    if (!code || !redirectUri || !clientId || !codeVerifier) {
      const missingParams = [];
      if (!code) missingParams.push('code');
      if (!redirectUri) missingParams.push('redirectUri');
      if (!clientId) missingParams.push('clientId');
      if (!codeVerifier) missingParams.push('codeVerifier');
      
      console.error('Missing required parameters:', missingParams);
      
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters',
        details: `Missing: ${missingParams.join(', ')}`,
        missingParams
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Get the client secret from environment variables
    const clientSecret = Deno.env.get('ONEDRIVE_CLIENT_SECRET');
    
    console.log('Checking client secret...');
    if (!clientSecret) {
      console.error('ONEDRIVE_CLIENT_SECRET environment variable not configured');
      return new Response(JSON.stringify({ 
        error: 'Client secret not configured',
        details: 'ONEDRIVE_CLIENT_SECRET environment variable is not set on the server. Please contact the administrator to configure this secret in Supabase Edge Functions settings.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log('Client secret found, proceeding with token exchange...');

    // Exchange the code for tokens using PKCE
    const tokenRequestBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier // PKCE parameter
    });

    console.log('Making request to Microsoft token endpoint...');
    console.log('Token request body (without secrets):', {
      client_id: `${clientId.substring(0, 8)}...`,
      code: `${code.substring(0, 10)}...`,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: 'present'
    });

    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenRequestBody
    });

    console.log('Microsoft response received');
    console.log('Response status:', tokenResponse.status);
    console.log('Response headers:', Object.fromEntries(tokenResponse.headers.entries()));

    // Check if the token request was successful
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Microsoft token exchange error:');
      console.error('Status:', tokenResponse.status);
      console.error('Response:', errorData);
      
      let userFriendlyMessage = 'Failed to exchange code for token';
      let errorDetails = errorData;

      try {
        const errorJson = JSON.parse(errorData);
        if (errorJson.error === 'invalid_client') {
          userFriendlyMessage = 'Invalid Client ID or Client Secret. Please verify your Azure app configuration.';
        } else if (errorJson.error === 'invalid_grant') {
          userFriendlyMessage = 'Authorization code expired or invalid. Please try the OAuth process again.';
        } else if (errorJson.error === 'invalid_request') {
          userFriendlyMessage = 'Invalid request parameters. Please check your redirect URI configuration.';
        } else if (errorJson.error_description) {
          userFriendlyMessage = `Microsoft error: ${errorJson.error_description}`;
        }
        errorDetails = JSON.stringify(errorJson, null, 2);
      } catch (parseError) {
        console.error('Could not parse Microsoft error response:', parseError);
      }
      
      return new Response(JSON.stringify({ 
        error: userFriendlyMessage,
        details: errorDetails,
        microsoftError: true,
        status: tokenResponse.status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Parse the token response
    console.log('Parsing successful token response...');
    const tokenData = await tokenResponse.json();
    console.log('Token data received successfully');
    console.log('Token type:', tokenData.token_type);
    console.log('Expires in:', tokenData.expires_in);
    console.log('Has access token:', !!tokenData.access_token);
    console.log('Has refresh token:', !!tokenData.refresh_token);

    // Return the token data
    return new Response(JSON.stringify(tokenData), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    // Log the error
    console.error('OneDrive token exchange error:', error);
    console.error('Error stack:', error.stack);
    
    // Return an error response
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      suggestion: 'Please check the server logs for more details and contact support if the issue persists.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
