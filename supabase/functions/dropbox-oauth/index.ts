
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
  // Log de la requête pour le débogage
  console.log(`Requête reçue: ${req.method} ${req.url}`);
  
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
      console.log("Accès refusé: l'utilisateur n'est pas administrateur");
      return new Response(JSON.stringify({ error: 'Accès non autorisé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extraire les données de la requête
    let requestData;
    if (req.method === 'POST') {
      try {
        requestData = await req.json();
        console.log('Données POST reçues:', requestData);
      } catch (e) {
        console.error('Erreur lors du parsing des données JSON:', e);
        requestData = {};
      }
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      
      requestData = { action, code, state };
      console.log('Données GET reçues:', requestData);
    }
    
    const action = requestData?.action || '';
    console.log(`Action demandée: ${action}`);

    // Générer l'URL d'authentification Dropbox
    if (action === 'get-auth-url') {
      // Vérifier que les variables d'environnement sont définies
      if (!dropboxAppKey) {
        console.error("DROPBOX_APP_KEY non configurée");
      }
      if (!redirectUri) {
        console.error("DROPBOX_REDIRECT_URI non configurée");
      }
      
      if (!dropboxAppKey || !redirectUri) {
        return new Response(JSON.stringify({ 
          error: 'Configuration Dropbox incomplète. Veuillez configurer DROPBOX_APP_KEY et DROPBOX_REDIRECT_URI.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Nettoyer la clé de l'application pour supprimer les espaces et tabulations
      const cleanAppKey = dropboxAppKey.trim();
      console.log(`Clé d'application nettoyée: ${cleanAppKey}`);

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
      authUrl.searchParams.append('client_id', cleanAppKey);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('state', stateValue);
      
      console.log(`URL d'authentification générée: ${authUrl.toString()}`);

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Échanger le code d'autorisation contre un token d'accès
    if (action === 'exchange-code') {
      const code = requestData?.code;
      const state = requestData?.state;

      if (!code || !state) {
        console.error(`Code ou state manquant. Code: ${code}, State: ${state}`);
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
        console.error('État OAuth invalide ou expiré:', stateError || 'Aucune donnée trouvée');
        return new Response(JSON.stringify({ error: 'State invalide ou expiré' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Vérifier que les variables d'environnement sont définies
      // Nettoyer les clés pour supprimer les espaces et tabulations
      const cleanAppKey = dropboxAppKey.trim();
      const cleanAppSecret = dropboxAppSecret.trim();
      const cleanRedirectUri = redirectUri.trim();

      if (!cleanAppKey || !cleanAppSecret || !cleanRedirectUri) {
        console.error('Configuration Dropbox incomplète pour l\'échange de jetons');
        console.log(`App Key: ${cleanAppKey ? 'OK' : 'Manquant'}`);
        console.log(`App Secret: ${cleanAppSecret ? 'OK' : 'Manquant'}`);
        console.log(`Redirect URI: ${cleanRedirectUri ? 'OK' : 'Manquant'}`);
        
        return new Response(JSON.stringify({ 
          error: 'Configuration Dropbox incomplète pour l\'échange de jetons.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Échanger le code contre un token d'accès
        console.log('Début de l\'échange du code contre un token...');
        console.log(`Code: ${code.substring(0, 10)}...`);
        console.log(`Redirect URI utilisée: ${cleanRedirectUri}`);
        
        const params = new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: cleanAppKey,
          client_secret: cleanAppSecret,
          redirect_uri: cleanRedirectUri,
        });

        console.log(`Paramètres de la requête de token: ${params.toString()}`);

        const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        });

        // Log de la réponse brute pour le débogage
        const responseText = await tokenResponse.text();
        console.log(`Statut de la réponse token: ${tokenResponse.status}`);
        console.log(`Réponse brute: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);

        if (!tokenResponse.ok) {
          console.error(`Erreur lors de l'échange du code: ${tokenResponse.status}`);
          return new Response(JSON.stringify({ 
            error: `Erreur lors de l'échange du code: ${tokenResponse.status} - ${responseText}` 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Parser la réponse JSON
        const tokenData = JSON.parse(responseText);
        console.log('Token obtenu avec succès');
        console.log(`Access Token: ${tokenData.access_token ? 'Présent' : 'Manquant'}`);
        console.log(`Refresh Token: ${tokenData.refresh_token ? 'Présent' : 'Manquant'}`);
        
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
          console.error(`Erreur lors de l'enregistrement du token:`, updateError);
          return new Response(JSON.stringify({ 
            error: `Erreur lors de l'enregistrement du token: ${updateError.message}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Authentification Dropbox réussie'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error(`Exception lors de l'échange du token:`, error);
        return new Response(JSON.stringify({ 
          error: `Exception lors de l'échange du token: ${error.message || 'Erreur inconnue'}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    console.error(`Action non supportée: ${action}`);
    return new Response(JSON.stringify({ error: 'Action non supportée' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error(`Erreur serveur:`, error);
    return new Response(JSON.stringify({ error: `Erreur serveur: ${error.message || 'Erreur inconnue'}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
