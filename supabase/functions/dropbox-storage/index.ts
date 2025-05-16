
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Les clés sont récupérées depuis les secrets Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Création du client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Headers CORS pour permettre les requêtes de n'importe quelle origine
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Vérification de la configuration Dropbox
async function getDropboxApiKey() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'dropbox_config')
      .single();
    
    if (error || !data) {
      console.log("Erreur ou données manquantes pour la config Dropbox:", error);
      return null;
    }
    
    console.log("Configuration Dropbox trouvée:", data.value);
    return data.value?.accessToken || Deno.env.get('DROPBOX_API_KEY') || null;
  } catch (error) {
    console.error("Erreur lors de la récupération de la clé API Dropbox:", error);
    return Deno.env.get('DROPBOX_API_KEY') || null;
  }
}

async function isDropboxEnabled() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'dropbox_config')
      .maybeSingle();  // Changed from single to maybeSingle to avoid errors when no record exists
    
    if (error) {
      console.log("Erreur lors de la récupération de la config Dropbox:", error);
      // Vérifier le secret comme fallback
      return !!Deno.env.get('DROPBOX_API_KEY');
    }
    
    // Si aucune donnée n'est trouvée, vérifier le secret comme fallback
    if (!data) {
      console.log("Aucune configuration Dropbox trouvée, vérification du secret...");
      return !!Deno.env.get('DROPBOX_API_KEY');
    }
    
    console.log("Configuration Dropbox trouvée:", data.value);
    return (data.value?.isEnabled && (data.value?.accessToken || Deno.env.get('DROPBOX_API_KEY'))) || false;
  } catch (error) {
    console.error("Erreur lors de la vérification du statut Dropbox:", error);
    // Vérifier le secret comme fallback
    return !!Deno.env.get('DROPBOX_API_KEY');
  }
}

// Fonction pour vérifier si un fichier existe sur Dropbox
async function checkFileExists(path: string) {
  try {
    console.log(`Vérification si le fichier existe sur Dropbox: ${path}`);
    
    const dropboxApiKey = await getDropboxApiKey();
    if (!dropboxApiKey) {
      console.error('Clé API Dropbox non disponible');
      return false;
    }
    
    // Check if the file exists on Dropbox using the get_metadata API
    const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dropboxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: path.startsWith('/') ? path : `/${path}`
      })
    });
    
    const exists = response.ok;
    console.log(`Le fichier ${path} existe: ${exists}`);
    return exists;
  } catch (error) {
    console.error('Error checking if file exists on Dropbox:', error);
    return false;
  }
}

// Fonction pour récupérer un lien partagé
async function getSharedLink(path: string) {
  console.log(`Création du lien partagé pour: ${path}`);
  try {
    const dropboxApiKey = await getDropboxApiKey();
    if (!dropboxApiKey) {
      throw new Error('Clé API Dropbox non disponible');
    }
    
    // Assurons-nous que le chemin est formaté correctement
    const formattedPath = path.startsWith('/') ? path : `/${path}`;
    console.log(`Chemin formatté: ${formattedPath}`);
    
    const response = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dropboxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: formattedPath,
        settings: {
          requested_visibility: "public"
        }
      })
    });
    
    // Si le lien existe déjà
    if (response.status === 409) {
      console.log("Le lien existe déjà, récupération du lien existant");
      const listResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dropboxApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: formattedPath
        })
      });
      
      if (!listResponse.ok) {
        const errorResponse = await listResponse.json().catch(() => ({}));
        console.error('Failed to list shared links:', errorResponse);
        throw new Error(`Failed to list shared links: ${listResponse.status}`);
      }
      
      const listData = await listResponse.json();
      
      if (listData.links && listData.links.length > 0) {
        let url = listData.links[0].url;
        url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        url = url.replace('?dl=0', '');
        
        console.log(`Lien partagé existant trouvé: ${url}`);
        return url;
      }
      
      throw new Error('No shared links found');
    }
    
    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      console.error('Failed to create shared link:', errorResponse);
      throw new Error(`Failed to create shared link: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convertir le lien en lien direct
    let url = data.url;
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    url = url.replace('?dl=0', '');
    
    console.log(`Lien partagé créé: ${url}`);
    return url;
  } catch (error) {
    console.error("Erreur lors de la création du lien partagé:", error);
    throw error;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    console.log(`Requête reçue avec la méthode ${req.method}`);
    
    // Vérifier que Dropbox est activé
    const enabled = await isDropboxEnabled();
    console.log(`Statut Dropbox: ${enabled ? 'Activé' : 'Désactivé'}`);
    
    if (!enabled) {
      console.log("Dropbox n'est pas activé");
      return new Response(JSON.stringify({ 
        error: 'Dropbox n\'est pas activé' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
        console.log(`Utilisateur authentifié: ${userId}`);
      }
    }
    
    let action;
    let path;
    let songId;
    
    if (req.method === 'GET') {
      // Pour les requêtes GET, lire les paramètres depuis l'URL
      const url = new URL(req.url);
      action = url.searchParams.get('action') || '';
      path = url.searchParams.get('path');
      songId = url.searchParams.get('songId');
      console.log(`Requête GET avec action=${action}, path=${path}, songId=${songId}`);
    } else {
      // Pour les autres méthodes, essayer de lire les paramètres depuis le body
      try {
        const body = await req.json();
        action = body.action || '';
        path = body.path;
        songId = body.songId;
        console.log(`Requête ${req.method} avec action=${action}, path=${path}, songId=${songId}`);
      } catch (error) {
        console.error('Error parsing request body:', error);
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Récupérer un fichier
    if (action === 'get' && path) {
      console.log(`Traitement de l'action 'get' pour le chemin ${path}`);
      // Récupérer le chemin Dropbox depuis la base de données
      const { data: fileRef } = await supabase
        .from('dropbox_files')
        .select('dropbox_path')
        .eq('local_id', path)
        .maybeSingle();  // Changed from single to maybeSingle
      
      const dropboxPath = fileRef?.dropbox_path || path;
      console.log(`Chemin Dropbox résolu: ${dropboxPath}`);
      
      // Vérifier si le fichier existe
      const exists = await checkFileExists(dropboxPath);
      if (!exists) {
        console.log(`Fichier ${dropboxPath} non trouvé sur Dropbox`);
        return new Response(JSON.stringify({ error: 'Fichier non trouvé' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const url = await getSharedLink(dropboxPath);
        console.log(`URL partagée récupérée: ${url}`);
        return new Response(JSON.stringify({ url }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error(`Erreur lors de la récupération du lien: ${error.message}`);
        return new Response(JSON.stringify({ error: `Erreur lors de la récupération du lien: ${error.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Télécharger des lyrics
    if (action === 'get-lyrics' && songId) {
      // Récupérer le chemin Dropbox depuis la base de données
      const { data: fileRef } = await supabase
        .from('dropbox_files')
        .select('dropbox_path')
        .eq('local_id', `lyrics/${songId}`)
        .maybeSingle();  // Changed from single to maybeSingle
      
      const dropboxPath = fileRef?.dropbox_path || `lyrics/${songId}`;
      
      // Vérifier si le fichier existe
      const exists = await checkFileExists(dropboxPath);
      if (!exists) {
        return new Response(JSON.stringify({ error: 'Paroles non trouvées' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const url = await getSharedLink(dropboxPath);
        
        // Télécharger le contenu des paroles
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Erreur lors du téléchargement: ${response.status}`);
        }
        
        const lyrics = await response.text();
        return new Response(JSON.stringify({ lyrics }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: `Erreur lors de la récupération des paroles: ${error.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Check if file exists
    if (action === 'check' && path) {
      const exists = await checkFileExists(path);
      console.log(`Vérification si ${path} existe: ${exists}`);
      return new Response(JSON.stringify({ exists }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Action ${action} non supportée`);
    return new Response(JSON.stringify({ error: 'Action ou méthode non supportée' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error(`Erreur serveur: ${error.message}`);
    return new Response(JSON.stringify({ error: `Erreur serveur: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
