
// supabase/functions/dropbox-config/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Configuration des clés
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
    console.log('Requête de configuration Dropbox reçue');

    // Vérifier si c'est une requête POST pour mettre à jour la configuration
    if (req.method === 'POST') {
      const requestData = await req.json();
      const { isEnabled, action } = requestData;

      // Si c'est une action de test, vérifier la connexion Dropbox
      if (action === 'test') {
        // Récupérer la configuration Dropbox
        const { data: configData, error: configError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'dropbox_config')
          .maybeSingle();

        if (configError) {
          console.error('Erreur lors de la récupération de la configuration:', configError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Erreur lors de la récupération de la configuration: ${configError.message}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!configData || !configData.value.accessToken) {
          console.error('Token d\'accès Dropbox manquant');
          return new Response(JSON.stringify({ 
            success: false,
            error: 'Token d\'accès Dropbox manquant'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Tester la connexion avec une requête à l'API Dropbox
        try {
          const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${configData.value.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(null),
          });

          if (response.ok) {
            const accountData = await response.json();
            console.log('Test de connexion réussi, compte Dropbox:', accountData.email);
            return new Response(JSON.stringify({ success: true, accountEmail: accountData.email }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            console.error('Échec du test de connexion:', response.status, response.statusText);
            return new Response(JSON.stringify({ 
              success: false,
              error: `Échec du test de connexion: ${response.status} ${response.statusText}`
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (error) {
          console.error('Erreur lors du test de la connexion:', error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Erreur lors du test de la connexion: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Mettre à jour la configuration
      const { error: updateError } = await supabase
        .from('app_settings')
        .upsert({
          key: 'dropbox_config',
          value: { 
            isEnabled: isEnabled === true,
            // On ne modifie pas l'accessToken existant ici
            updated_at: new Date().toISOString()
          },
        }, { onConflict: 'key' });

      if (updateError) {
        console.error('Erreur lors de la mise à jour de la configuration:', updateError);
        return new Response(JSON.stringify({ 
          error: `Erreur lors de la mise à jour de la configuration: ${updateError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Configuration mise à jour avec succès');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Récupérer la configuration Dropbox depuis la base de données
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'dropbox_config')
      .maybeSingle();

    if (error) {
      console.error('Erreur lors de la récupération de la configuration Dropbox:', error);
      return new Response(JSON.stringify({ 
        isEnabled: false,
        error: `Erreur lors de la récupération de la configuration: ${error.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérifier si la configuration existe et est activée
    const dropboxConfig = data?.value || { isEnabled: false };
    const isEnabled = dropboxConfig.isEnabled === true && 
                    dropboxConfig.accessToken && 
                    dropboxConfig.isGlobalAccess === true;

    console.log('État de la configuration Dropbox:', { 
      isEnabled, 
      hasToken: !!dropboxConfig.accessToken,
      isGlobal: dropboxConfig.isGlobalAccess === true
    });

    return new Response(JSON.stringify({ 
      isEnabled,
      // Ne pas inclure le token d'accès dans la réponse pour des raisons de sécurité
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erreur serveur:', error);
    return new Response(JSON.stringify({
      isEnabled: false,
      error: `Erreur serveur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
