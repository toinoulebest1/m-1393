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
    // Extraire les données de la requête
    let requestData;
    if (req.method === 'POST') {
      try {
        requestData = await req.json();
        console.log('Données POST reçues:', requestData);
      } catch (e) {
        console.error('Erreur lors du parsing des données JSON:', e);
        return new Response(JSON.stringify({
          error: 'Format de données invalide'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
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
        return new Response(JSON.stringify({ 
          error: 'DROPBOX_APP_KEY non configurée' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (!redirectUri) {
        console.error("DROPBOX_REDIRECT_URI non configurée");
        return new Response(JSON.stringify({ 
          error: 'DROPBOX_REDIRECT_URI non configurée' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Nettoyer la clé de l'application pour supprimer les espaces et tabulations
      const cleanAppKey = dropboxAppKey.trim();
      console.log(`Clé d'application nettoyée: ${cleanAppKey}`);
      console.log(`Redirect URI: ${redirectUri}`);

      // Générer une chaîne aléatoire pour le state (sécurité CSRF)
      const stateValue = crypto.randomUUID();
      
      try {
        // Stocker le state dans la base de données pour validation ultérieure
        const { error: insertError } = await supabase
          .from('oauth_states')
          .insert({
            state: stateValue,
            created_at: new Date().toISOString(),
            provider: 'dropbox'
          });
          
        if (insertError) {
          console.error('Erreur lors de l\'enregistrement du state:', insertError);
          return new Response(JSON.stringify({ 
            error: `Erreur lors de l'enregistrement du state: ${insertError.message}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Construire l'URL d'authentification Dropbox en demandant spécifiquement un refresh token
        const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
        authUrl.searchParams.append('client_id', cleanAppKey);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('redirect_uri', redirectUri.trim());
        authUrl.searchParams.append('state', stateValue);
        authUrl.searchParams.append('token_access_type', 'offline');
        
        console.log(`URL d'authentification générée: ${authUrl.toString()}`);

        return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Erreur lors de la génération de l\'URL d\'authentification:', error);
        return new Response(JSON.stringify({ 
          error: `Erreur serveur: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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

      try {
        // Vérifier le state pour prévenir les attaques CSRF
        const { data: stateData, error: stateError } = await supabase
          .from('oauth_states')
          .select('*')
          .eq('state', state)
          .eq('provider', 'dropbox')
          .maybeSingle();

        if (stateError) {
          console.error('Erreur lors de la vérification du state:', stateError);
          return new Response(JSON.stringify({ 
            error: `Erreur lors de la vérification du state: ${stateError.message}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!stateData) {
          console.error('État OAuth invalide ou expiré');
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
            status: tokenResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Parser la réponse JSON
        let tokenData;
        try {
          tokenData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Erreur lors du parsing de la réponse de token:', parseError);
          return new Response(JSON.stringify({ 
            error: `Erreur lors du parsing de la réponse: ${parseError instanceof Error ? parseError.message : 'Erreur inconnue'}`,
            rawResponse: responseText
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('Token obtenu avec succès');
        console.log(`Access Token: ${tokenData.access_token ? 'Présent' : 'Manquant'}`);
        console.log(`Refresh Token: ${tokenData.refresh_token ? 'Présent' : 'Manquant'}`);
        
        // Vérifier si la table app_settings existe
        try {
          // Vérifier si la table app_settings existe
          const { error: checkError } = await supabase
            .from('app_settings')
            .select('id')
            .limit(1);

          if (checkError) {
            console.error("Erreur lors de la vérification de la table app_settings:", checkError);
            return new Response(JSON.stringify({ 
              error: `La table app_settings n'existe pas ou n'est pas accessible: ${checkError.message}`
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Enregistrer le token dans la base de données globalement
          const { error: upsertError } = await supabase
            .from('app_settings')
            .upsert({ 
              key: 'dropbox_config', 
              value: { 
                isEnabled: true,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token, // Stocker le refresh token
                expiresAt: tokenData.expires_in ? 
                  new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : 
                  null,
                isGlobalAccess: true // Marquer comme accès global pour tous les utilisateurs
              },
              updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
          
          if (upsertError) {
            console.error(`Erreur lors de l'enregistrement du token:`, upsertError);
            return new Response(JSON.stringify({ 
              error: `Erreur lors de l'enregistrement du token: ${upsertError.message}` 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Supprimer le state utilisé pour la sécurité CSRF
          await supabase
            .from('oauth_states')
            .delete()
            .eq('state', state);

          // Synchroniser le localStorage pour l'interface utilisateur
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Authentification Dropbox réussie'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (dbError) {
          console.error(`Erreur base de données lors de l'enregistrement du token:`, dbError);
          return new Response(JSON.stringify({ 
            error: `Erreur lors de l'enregistrement du token: ${dbError instanceof Error ? dbError.message : 'Erreur inconnue'}`
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        console.error(`Exception lors de l'échange du token:`, error);
        return new Response(JSON.stringify({ 
          error: `Exception lors de l'échange du token: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
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
    return new Response(JSON.stringify({ 
      error: `Erreur serveur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
