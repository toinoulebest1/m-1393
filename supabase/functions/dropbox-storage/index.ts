
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
    // Vérifier d'abord dans les secrets d'environnement (plus fiable)
    const envApiKey = Deno.env.get('DROPBOX_API_KEY');
    if (envApiKey) {
      console.log("Utilisation de la clé API Dropbox depuis les secrets d'environnement");
      return envApiKey;
    }
    
    // Sinon, chercher dans la base de données
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'dropbox_config')
      .single();
    
    if (error || !data) {
      console.error("Erreur ou données manquantes pour la config Dropbox:", error);
      return null;
    }
    
    console.log("Configuration Dropbox trouvée:", data.value);
    return data.value?.accessToken || null;
  } catch (error) {
    console.error("Erreur lors de la récupération de la clé API Dropbox:", error);
    return null;
  }
}

async function isDropboxEnabled() {
  try {
    // Vérifier d'abord dans les secrets d'environnement
    const envApiKey = Deno.env.get('DROPBOX_API_KEY');
    
    // Chercher dans la base de données
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'dropbox_config')
      .maybeSingle();
    
    if (error) {
      console.error("Erreur lors de la récupération de la config Dropbox:", error);
      // Vérifier le secret comme fallback
      return !!envApiKey;
    }
    
    // Si aucune donnée n'est trouvée, vérifier le secret comme fallback
    if (!data) {
      console.log("Aucune configuration Dropbox trouvée, vérification du secret...");
      return !!envApiKey;
    }
    
    console.log("Configuration Dropbox trouvée:", data.value);
    return (data.value?.isEnabled && (data.value?.accessToken || envApiKey)) || false;
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
    
    // Formater correctement le chemin
    const formattedPath = path.startsWith('/') ? path : `/${path}`;
    console.log(`Chemin formatté pour vérification: ${formattedPath}`);
    
    // Check if the file exists on Dropbox using the get_metadata API
    const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dropboxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: formattedPath
      })
    });
    
    if (response.status === 409) {
      // Le fichier n'existe pas (erreur 409)
      console.error(`Le fichier ${formattedPath} n'existe pas sur Dropbox (erreur 409)`);
      const errorData = await response.json().catch(() => ({}));
      console.error("Détails de l'erreur Dropbox:", JSON.stringify(errorData));
      return false;
    }
    
    const exists = response.ok;
    console.log(`Le fichier ${formattedPath} existe: ${exists}`);
    
    if (!exists) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Détails de l'erreur Dropbox:", JSON.stringify(errorData));
    }
    
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
    
    // Vérifier d'abord si le fichier existe
    if (!await checkFileExists(formattedPath)) {
      console.error(`Le fichier ${formattedPath} n'existe pas sur Dropbox!`);
      throw new Error(`Fichier ${formattedPath} non trouvé sur Dropbox`);
    }
    
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
      const errorResponse = await response.json().catch(() => ({}));
      console.log("Détails de la réponse 409:", JSON.stringify(errorResponse));
      
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
        const errorData = await listResponse.json().catch(() => ({}));
        console.error('Failed to list shared links:', errorData);
        throw new Error(`Failed to list shared links: ${listResponse.status}`);
      }
      
      const listData = await listResponse.json();
      console.log("Liste des liens partagés:", JSON.stringify(listData));
      
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
    console.log("Réponse de création de lien:", JSON.stringify(data));
    
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
      // Récupérer le chemin Dropbox depuis la base de données si disponible
      let dropboxPath = path;
      try {
        const { data: fileRef } = await supabase
          .from('dropbox_files')
          .select('dropbox_path')
          .eq('local_id', path)
          .maybeSingle();
        
        if (fileRef?.dropbox_path) {
          dropboxPath = fileRef.dropbox_path;
          console.log(`Chemin Dropbox résolu depuis la BD: ${dropboxPath}`);
        } else {
          console.log(`Aucune référence trouvée dans la BD, utilisation du chemin direct: ${dropboxPath}`);
        }
      } catch (dbError) {
        console.error('Erreur BD lors de la récupération de la référence:', dbError);
      }
      
      // Vérifier si le fichier existe
      const formattedDropboxPath = dropboxPath.startsWith('/') ? dropboxPath : `/${dropboxPath}`;
      console.log(`Vérification si le fichier existe: ${formattedDropboxPath}`);
      
      const exists = await checkFileExists(formattedDropboxPath);
      if (!exists) {
        console.log(`Fichier ${formattedDropboxPath} non trouvé sur Dropbox`);
        return new Response(JSON.stringify({ error: 'Fichier non trouvé' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const url = await getSharedLink(formattedDropboxPath);
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
      const formattedPath = path.startsWith('/') ? path : `/${path}`;
      console.log(`Vérification d'existence pour: ${formattedPath}`);
      
      const exists = await checkFileExists(formattedPath);
      console.log(`Vérification si ${formattedPath} existe: ${exists}`);
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
