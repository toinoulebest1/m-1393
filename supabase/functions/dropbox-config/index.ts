
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Les clés sont récupérées depuis les secrets Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const dropboxApiKey = Deno.env.get('DROPBOX_API_KEY') || '';

// Création du client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  // Vérifier que l'utilisateur est authentifié et admin
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Vérifier l'authentification
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Vérifier si l'utilisateur est admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
      
    if (roleError || roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Accès refusé' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Récupérer la configuration actuelle
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'dropbox_config')
        .single();
      
      const config = data?.value || { isEnabled: false };
      return new Response(JSON.stringify(config), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Traiter les opérations POST (configuration et test)
    if (req.method === 'POST') {
      const requestData = await req.json();
      
      // Tester la connexion Dropbox
      if (requestData.action === 'test') {
        if (!dropboxApiKey) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Clé API Dropbox non configurée' 
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        try {
          // Test de la clé API avec une requête vers l'API Dropbox
          const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dropboxApiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const accountData = await response.json();
            return new Response(JSON.stringify({ 
              success: true, 
              account: accountData.email
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({ 
              success: false, 
              error: `Erreur Dropbox: ${response.status} ${response.statusText}`
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch (error) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Erreur lors du test: ${error.message}`
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Enregistrer la nouvelle configuration
      const { isEnabled } = requestData;
      
      // Vérifier si la table app_settings existe déjà, sinon la créer
      const { error: tableCheckError } = await supabase
        .from('app_settings')
        .select('key')
        .limit(1);
        
      if (tableCheckError && tableCheckError.code === 'PGRST116') {
        // La table n'existe pas, la créer
        await supabase.rpc('create_app_settings_table');
      }
      
      // Mettre à jour ou insérer la configuration
      const { error: upsertError } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'dropbox_config', 
          value: { isEnabled },
          updated_at: new Date().toISOString()
        });
      
      if (upsertError) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Erreur lors de l'enregistrement: ${upsertError.message}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        isEnabled 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Méthode non supportée' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: `Erreur serveur: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
