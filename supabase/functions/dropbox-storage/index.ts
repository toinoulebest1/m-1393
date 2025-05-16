
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Les clés sont récupérées depuis les secrets Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const dropboxApiKey = Deno.env.get('DROPBOX_API_KEY') || '';

// Création du client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Vérification de la configuration Dropbox
async function isDropboxEnabled() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'dropbox_config')
    .single();
  
  if (error || !data) {
    return false;
  }
  
  return data.value?.isEnabled && dropboxApiKey;
}

// Fonction pour vérifier si un fichier existe sur Dropbox
async function checkFileExists(path: string) {
  try {
    // Check if the file exists on Dropbox using the get_metadata API
    const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dropboxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: `/${path}`
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error checking if file exists on Dropbox:', error);
    return false;
  }
}

// Fonction pour récupérer un lien partagé
async function getSharedLink(path: string) {
  try {
    const response = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dropboxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: `/${path}`,
        settings: {
          requested_visibility: "public"
        }
      })
    });
    
    // Si le lien existe déjà
    if (response.status === 409) {
      const listResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dropboxApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: `/${path}`
        })
      });
      
      if (!listResponse.ok) {
        throw new Error('Failed to list shared links');
      }
      
      const listData = await listResponse.json();
      
      if (listData.links && listData.links.length > 0) {
        let url = listData.links[0].url;
        url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        url = url.replace('?dl=0', '');
        
        return url;
      }
      
      throw new Error('No shared links found');
    }
    
    if (!response.ok) {
      throw new Error(`Failed to create shared link: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convertir le lien en lien direct
    let url = data.url;
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    url = url.replace('?dl=0', '');
    
    return url;
  } catch (error) {
    throw error;
  }
}

serve(async (req: Request) => {
  // Vérifier que Dropbox est activé
  const enabled = await isDropboxEnabled();
  if (!enabled || !dropboxApiKey) {
    return new Response(JSON.stringify({ 
      error: 'Dropbox n\'est pas activé ou la clé API n\'est pas configurée' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }
    
    const url = new URL(req.url);
    let action;
    let path;
    let songId;
    
    if (req.method === 'GET') {
      // Pour les requêtes GET, lire les paramètres depuis l'URL
      action = url.searchParams.get('action') || '';
      path = url.searchParams.get('path');
      songId = url.searchParams.get('songId');
    } else {
      // Pour les autres méthodes, essayer de lire les paramètres depuis le body
      try {
        const body = await req.json();
        action = body.action || '';
        path = body.path;
        songId = body.songId;
      } catch (error) {
        console.error('Error parsing request body:', error);
      }
    }
    
    // Récupérer un fichier
    if (action === 'get' && path) {
      // Récupérer le chemin Dropbox depuis la base de données
      const { data: fileRef } = await supabase
        .from('dropbox_files')
        .select('dropbox_path')
        .eq('local_id', path)
        .maybeSingle();
      
      const dropboxPath = fileRef?.dropbox_path || path;
      
      // Vérifier si le fichier existe
      const exists = await checkFileExists(dropboxPath);
      if (!exists) {
        return new Response(JSON.stringify({ error: 'Fichier non trouvé' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const url = await getSharedLink(dropboxPath);
        return new Response(JSON.stringify({ url }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: `Erreur lors de la récupération du lien: ${error.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
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
        .maybeSingle();
      
      const dropboxPath = fileRef?.dropbox_path || `lyrics/${songId}`;
      
      // Vérifier si le fichier existe
      const exists = await checkFileExists(dropboxPath);
      if (!exists) {
        return new Response(JSON.stringify({ error: 'Paroles non trouvées' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
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
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: `Erreur lors de la récupération des paroles: ${error.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Check if file exists
    if (action === 'check' && path) {
      const exists = await checkFileExists(path);
      return new Response(JSON.stringify({ exists }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Action ou méthode non supportée' }), {
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
