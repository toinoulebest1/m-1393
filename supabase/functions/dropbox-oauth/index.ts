
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Les clés sont récupérées depuis les secrets Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const dropboxAppKey = Deno.env.get('DROPBOX_APP_KEY') || '';
const dropboxAppSecret = Deno.env.get('DROPBOX_APP_SECRET') || '';
const redirectUri = Deno.env.get('DROPBOX_REDIRECT_URI') || '';

// Création du client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// En-têtes CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req: Request) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    let isAdmin = false;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        // Vérifier si l'utilisateur est admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
          
        isAdmin = roleData?.role === 'admin';
      }
    }
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Accès non autorisé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || '';

    // Générer l'URL d'authentification Dropbox
    if (action === 'get-auth-url') {
      if (!dropboxAppKey || !redirectUri) {
        return new Response(JSON.stringify({ 
          error: 'Configuration Dropbox incomplète. Veuillez configurer DROPBOX_APP_KEY et DROPBOX_REDIRECT_URI.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Générer une chaîne aléatoire pour le state (sécurité CSRF)
      const stateValue = crypto.randomUUID();
      
      // Stocker le state dans la base de données pour validation ultérieure
      await supabase
        .from('oauth_states')
        .insert({
          state: stateValue,
          created_at: new Date().toISOString(),
          provider: 'dropbox'
        });

      // Construire l'URL d'authentification Dropbox
      const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
      authUrl.searchParams.append('client_id', dropboxAppKey);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('state', stateValue);

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Échanger le code d'autorisation contre un token d'accès
    if (action === 'exchange-code') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code || !state) {
        return new Response(JSON.stringify({ error: 'Code ou state manquant' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Vérifier le state pour prévenir les attaques CSRF
      const { data: stateData, error: stateError } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .eq('provider', 'dropbox')
        .single();

      if (stateError || !stateData) {
        return new Response(JSON.stringify({ error: 'State invalide ou expiré' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Échanger le code contre un token d'accès
      const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: dropboxAppKey,
          client_secret: dropboxAppSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        return new Response(JSON.stringify({ 
          error: `Erreur lors de l'échange du code: ${tokenResponse.status} - ${errorText}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Extraire le token d'accès
      const tokenData = await tokenResponse.json();
      
      // Enregistrer le token dans la base de données
      const { error: updateError } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'dropbox_config', 
          value: { 
            isEnabled: true,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_in ? 
              new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : 
              null
          },
          updated_at: new Date().toISOString()
        });
      
      if (updateError) {
        return new Response(JSON.stringify({ 
          error: `Erreur lors de l'enregistrement du token: ${updateError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Enregistrer le token dans le secret Supabase
      // Note: dans un environnement réel, nous devrions utiliser un API admin pour cela,
      // mais nous allons simuler cette partie pour le moment

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Authentification Dropbox réussie'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Action non supportée' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: `Erreur serveur: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
