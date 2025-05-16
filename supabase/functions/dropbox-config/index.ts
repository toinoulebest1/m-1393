
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
