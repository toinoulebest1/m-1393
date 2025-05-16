
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Configuration from environment
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const dropboxAppKey = Deno.env.get('DROPBOX_APP_KEY') || '';
const dropboxAppSecret = Deno.env.get('DROPBOX_APP_SECRET') || '';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Refresh token helper function
async function refreshToken(refreshToken: string): Promise<any> {
  console.log("Requesting new access token with refresh token");
  
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: dropboxAppKey,
      client_secret: dropboxAppSecret,
    });

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Token refresh failed with status ${response.status}: ${errorText}`);
      return { error: `Failed to refresh token: ${response.status} ${errorText}` };
    }

    const tokenData = await response.json();
    console.log("Successfully refreshed token");
    
    return { ...tokenData, success: true };
  } catch (error) {
    console.error("Error refreshing token:", error);
    return { error: `Exception during token refresh: ${error.message || 'Unknown error'}` };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Token refresh request received");
    
    // Get the current Dropbox configuration from the database
    const { data: configData, error: configError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'dropbox_config')
      .maybeSingle();
    
    if (configError) {
      console.error("Error retrieving Dropbox config:", configError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Error retrieving Dropbox configuration: ${configError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!configData || !configData.value) {
      console.error("No Dropbox configuration found");
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No Dropbox configuration found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Extract refresh token
    const refreshToken = configData.value.refreshToken;
    
    if (!refreshToken) {
      console.error("No refresh token found in configuration");
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No refresh token available' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Execute token refresh
    const tokenResponse = await refreshToken(refreshToken);
    
    if (tokenResponse.error || !tokenResponse.success) {
      console.error("Token refresh failed:", tokenResponse.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: tokenResponse.error 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Update the stored configuration with the new token
    const newConfig = {
      ...configData.value,
      accessToken: tokenResponse.access_token,
      expiresAt: tokenResponse.expires_in ? 
        new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString() : 
        null
    };
    
    const { error: updateError } = await supabase
      .from('app_settings')
      .update({
        value: newConfig,
        updated_at: new Date().toISOString()
      })
      .eq('key', 'dropbox_config');
    
    if (updateError) {
      console.error("Error updating token in database:", updateError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Error updating configuration: ${updateError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Token refreshed successfully',
      expiresAt: newConfig.expiresAt
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error("Server error during token refresh:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Server error: ${error.message || 'Unknown error'}` 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
