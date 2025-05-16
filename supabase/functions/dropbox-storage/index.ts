
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

// Memory limit metrics for debugging
let memoryUsage = {
  initialUsage: 0,
  currentOperation: '',
  peakUsage: 0
};

// Track memory usage
function trackMemory(operation) {
  try {
    // @ts-ignore: Deno specific
    const memoryStats = Deno.memoryUsage();
    const currentUsage = Math.round(memoryStats.heapUsed / 1024 / 1024);
    
    if (memoryUsage.initialUsage === 0) {
      memoryUsage.initialUsage = currentUsage;
    }
    
    memoryUsage.currentOperation = operation;
    memoryUsage.peakUsage = Math.max(memoryUsage.peakUsage, currentUsage);
    
    console.log(`Memory usage [${operation}]: ${currentUsage}MB (peak: ${memoryUsage.peakUsage}MB)`);
  } catch (e) {
    console.error("Cannot track memory:", e);
  }
}

// Vérification de la configuration Dropbox
async function getDropboxApiKey() {
  try {
    trackMemory("getDropboxApiKey-start");
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
    
    trackMemory("getDropboxApiKey-end");
    
    if (error || !data) {
      console.error("Erreur ou données manquantes pour la config Dropbox:", error);
      return null;
    }
    
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
    if (envApiKey) {
      console.log("Dropbox activé via secret d'environnement");
      return true;
    }
    
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
    
    return (data.value?.isEnabled && (data.value?.accessToken || envApiKey)) || false;
  } catch (error) {
    console.error("Erreur lors de la vérification du statut Dropbox:", error);
    // Vérifier le secret comme fallback
    return !!Deno.env.get('DROPBOX_API_KEY');
  }
}

// Fonction pour vérifier si un fichier existe sur Dropbox
async function checkFileExists(path) {
  try {
    trackMemory("checkFileExists-start");
    // Normalisation du chemin
    const formattedPath = path.startsWith('/') ? path : `/${path}`;
    console.log(`Vérification si le fichier existe sur Dropbox: ${formattedPath}`);
    
    // Tentative de récupération de la clé API Dropbox
    const dropboxApiKey = await getDropboxApiKey();
    if (!dropboxApiKey) {
      console.error('Clé API Dropbox non disponible');
      return false;
    }
    
    // Vérifier si le fichier existe avec l'API Dropbox
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
    
    trackMemory("checkFileExists-end");
    
    if (response.status === 409) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Le fichier n'existe pas sur Dropbox (erreur 409):", formattedPath);
      console.error("Détails de l'erreur:", JSON.stringify(errorData));
      return false;
    }
    
    const exists = response.ok;
    console.log(`Le fichier ${formattedPath} existe: ${exists}`);
    
    if (!exists) {
      try {
        const errorData = await response.json();
        console.error("Détails de l'erreur Dropbox:", JSON.stringify(errorData));
      } catch (e) {
        console.error("Impossible de lire la réponse d'erreur");
      }
    }
    
    return exists;
  } catch (error) {
    console.error('Erreur lors de la vérification si le fichier existe:', error);
    return false;
  }
}

// Fonction pour démarrer une session d'upload
async function startUploadSession(dropboxApiKey) {
  trackMemory("startUploadSession-start");
  const response = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${dropboxApiKey}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        close: false
      })
    },
    body: new Uint8Array() // Démarrer avec un corps vide
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur lors du démarrage de la session: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  trackMemory("startUploadSession-end");
  return data.session_id;
}

// Fonction pour ajouter un bloc à une session d'upload
async function appendToUploadSession(dropboxApiKey, sessionId, offset, chunk) {
  trackMemory(`appendChunk-${offset}-start`);
  console.log(`Ajout d'un bloc à la session: session_id=${sessionId}, offset=${offset}, taille=${chunk.length}`);

  const response = await fetch('https://content.dropboxapi.com/2/files/upload_session/append_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${dropboxApiKey}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        cursor: {
          session_id: sessionId,
          offset: offset
        },
        close: false
      })
    },
    body: chunk
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur lors de l'ajout à la session: ${response.status} - ${errorText}`);
  }
  
  trackMemory(`appendChunk-${offset}-end`);
}

// Fonction pour finaliser une session d'upload
async function finishUploadSession(dropboxApiKey, sessionId, offset, lastChunk, path) {
  trackMemory("finishUploadSession-start");
  console.log(`Finalisation de la session d'upload: session_id=${sessionId}, offset=${offset}, path=${path}`);
  
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  
  const response = await fetch('https://content.dropboxapi.com/2/files/upload_session/finish', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${dropboxApiKey}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        cursor: {
          session_id: sessionId,
          offset: offset
        },
        commit: {
          path: formattedPath,
          mode: 'overwrite',
          autorename: true,
          mute: false
        }
      })
    },
    body: lastChunk
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur lors de la finalisation: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  trackMemory("finishUploadSession-end");
  return data;
}

// Fonction optimisée pour télécharger un fichier en utilisant les sessions d'upload
async function uploadLargeFile(dropboxApiKey, path, contentData) {
  trackMemory("uploadLargeFile-start");
  console.log(`Upload d'un fichier volumineux vers ${path}, taille: ${contentData.length} octets`);

  try {
    // Démarrer une session d'upload
    const sessionId = await startUploadSession(dropboxApiKey);
    console.log(`Session d'upload créée avec ID: ${sessionId}`);
    
    // Diviser le fichier en chunks de 2MB (plus petit que les 4MB habituels pour limiter l'usage mémoire)
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
    let offset = 0;
    
    while (offset < contentData.length) {
      // Créer un chunk de taille appropriée
      const end = Math.min(offset + CHUNK_SIZE, contentData.length);
      const chunk = contentData.slice(offset, end);
      const isLastChunk = end === contentData.length;
      
      if (isLastChunk) {
        // Finaliser la session avec le dernier chunk
        const result = await finishUploadSession(dropboxApiKey, sessionId, offset, chunk, path);
        console.log(`Upload terminé avec succès: ${result.path_display}`);
        
        // Enregistrer la référence dans la base de données
        const localId = path.startsWith('/') ? path.substring(1) : path;
        await supabase
          .from('dropbox_files')
          .upsert({
            local_id: localId,
            dropbox_path: result.path_display
          });
        
        return result.path_display;
      } else {
        // Ajouter le chunk à la session
        await appendToUploadSession(dropboxApiKey, sessionId, offset, chunk);
        console.log(`Chunk ${offset}-${end}/${contentData.length} téléchargé`);
      }
      
      offset = end;
    }
    
    throw new Error("Erreur inattendue: fin de la boucle sans atteindre le dernier chunk");
  } catch (error) {
    console.error("Erreur lors de l'upload par session:", error);
    throw error;
  } finally {
    trackMemory("uploadLargeFile-end");
  }
}

// Fonction pour uploader un fichier, optimisée pour la gestion de mémoire
async function uploadToDropbox(content, path, contentType = 'application/octet-stream') {
  try {
    trackMemory("uploadToDropbox-start");
    console.log(`Téléchargement du fichier vers Dropbox: ${path}, type: ${contentType}`);
    
    // Obtenir la clé API
    const dropboxApiKey = await getDropboxApiKey();
    if (!dropboxApiKey) {
      throw new Error('Clé API Dropbox non disponible');
    }
    
    // Normaliser le chemin
    const formattedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Convertir ou valider le contenu
    let contentData;
    try {
      if (typeof content === 'string') {
        const encoder = new TextEncoder();
        contentData = encoder.encode(content);
      } else if (Array.isArray(content)) {
        // Si c'est un tableau de nombres (typiquement envoyé depuis le client)
        contentData = new Uint8Array(content);
      } else {
        contentData = content;
      }
      
      console.log(`Taille du fichier à télécharger: ${contentData.length} octets`);
      
      // Pour les fichiers volumineux, utiliser l'API de session d'upload (> 1MB)
      if (contentData.length > 1 * 1024 * 1024) { // 1MB
        return await uploadLargeFile(dropboxApiKey, formattedPath, contentData);
      }
      
      // Pour les fichiers plus petits, utiliser l'API standard
      const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dropboxApiKey}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: formattedPath,
            mode: 'overwrite',
            autorename: true,
            mute: false
          })
        },
        body: contentData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erreur lors de l'upload: ${response.status} - ${errorText}`);
        throw new Error(`Erreur d'upload: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`Fichier téléchargé avec succès vers: ${data.path_display}`);
      
      // Enregistrer la référence dans la base de données
      const localId = path.startsWith('/') ? path.substring(1) : path;
      await supabase
        .from('dropbox_files')
        .upsert({
          local_id: localId,
          dropbox_path: data.path_display
        });
      
      return data.path_display;
    } catch (conversionError) {
      console.error('Erreur lors du traitement du contenu:', conversionError);
      throw conversionError;
    }
  } catch (error) {
    console.error('Erreur lors du téléchargement vers Dropbox:', error);
    throw error;
  } finally {
    trackMemory("uploadToDropbox-end");
  }
}

// Fonction pour créer un lien de partage pour un fichier ou créer le fichier si nécessaire
async function getSharedLink(path) {
  try {
    trackMemory("getSharedLink-start");
    console.log(`Création du lien partagé pour: ${path}`);
    
    // Obtenir la clé API Dropbox
    const dropboxApiKey = await getDropboxApiKey();
    if (!dropboxApiKey) {
      throw new Error('Clé API Dropbox non disponible');
    }
    
    // Assurer que le chemin est correctement formatté
    const formattedPath = path.startsWith('/') ? path : `/${path}`;
    console.log(`Chemin formatté: ${formattedPath}`);
    
    // Vérifier si le fichier existe
    const fileExists = await checkFileExists(formattedPath);
    console.log(`Le fichier existe-t-il? ${fileExists}`);
    
    if (!fileExists) {
      console.log(`Le fichier ${formattedPath} n'existe pas sur Dropbox.`);
      // Retourner une erreur explicite
      return new Response(
        JSON.stringify({ error: `Fichier non trouvé: ${formattedPath}` }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Tenter de créer un lien partagé
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
    
    // Gérer le cas où le lien existe déjà (code 409)
    if (response.status === 409) {
      console.log("Le lien existe déjà, récupération du lien existant");
      
      // Récupérer les liens partagés existants
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
        console.error('Échec de la récupération des liens partagés:', errorData);
        throw new Error(`Échec de la récupération des liens partagés: ${listResponse.status}`);
      }
      
      const listData = await listResponse.json();
      console.log("Liste des liens partagés:", JSON.stringify(listData));
      
      if (listData.links && listData.links.length > 0) {
        // Convertir l'URL pour accès direct
        let url = listData.links[0].url;
        url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        url = url.replace('?dl=0', '');
        
        console.log(`Lien partagé existant trouvé: ${url}`);
        trackMemory("getSharedLink-end");
        return new Response(
          JSON.stringify({ url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Aucun lien partagé trouvé');
    }
    
    // Gérer les autres erreurs
    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      console.error('Échec de la création du lien partagé:', errorResponse);
      throw new Error(`Échec de la création du lien partagé: ${response.status}`);
    }
    
    // Traiter la réponse réussie
    const data = await response.json();
    
    // Convertir le lien en lien direct
    let url = data.url;
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    url = url.replace('?dl=0', '');
    
    console.log(`Lien partagé créé: ${url}`);
    trackMemory("getSharedLink-end");
    return new Response(
      JSON.stringify({ url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Erreur lors de la création du lien partagé:", error);
    return new Response(
      JSON.stringify({ error: `Erreur lors de la création du lien partagé: ${error.message}` }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

serve(async (req: Request) => {
  trackMemory("request-start");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    console.log(`Requête reçue avec la méthode ${req.method}`);
    
    // Vérifier que Dropbox est activé
    const dropboxEnabled = await isDropboxEnabled();
    console.log(`Statut Dropbox: ${dropboxEnabled ? 'Activé' : 'Désactivé'}`);
    
    if (!dropboxEnabled) {
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
    let fileContent;
    let contentType;
    
    if (req.method === 'GET') {
      // Pour les requêtes GET, lire les paramètres depuis l'URL
      const url = new URL(req.url);
      action = url.searchParams.get('action') || '';
      path = url.searchParams.get('path');
      songId = url.searchParams.get('songId');
      console.log(`Requête GET avec action=${action}, path=${path}, songId=${songId}`);
    } else {
      // Pour les autres méthodes, lire les paramètres depuis le body
      try {
        // Limite de taille stricte pour éviter les problèmes de mémoire
        const MAX_SIZE_FOR_JSON = 10 * 1024 * 1024; // 10MB max pour le parsing JSON
        
        if (req.headers.get('Content-Type')?.includes('application/json')) {
          // Pour les requêtes JSON, lire le texte et le parser
          const bodyText = await req.text();
          if (bodyText.length > MAX_SIZE_FOR_JSON) {
            return new Response(JSON.stringify({
              error: 'Requête trop grande pour le parsing JSON, utilisez multipart/form-data'
            }), {
              status: 413,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const body = JSON.parse(bodyText);
          action = body.action || '';
          path = body.path;
          songId = body.songId;
          fileContent = body.fileContent;
          contentType = body.contentType;
          console.log(`Requête ${req.method} (JSON) avec action=${action}, path=${path}, songId=${songId}, taille content=${fileContent ? (Array.isArray(fileContent) ? fileContent.length : 'texte') : 'aucun'}`);
        } else {
          // Pour les requêtes multipart/form-data
          const formData = await req.formData();
          action = formData.get('action')?.toString() || '';
          path = formData.get('path')?.toString() || '';
          songId = formData.get('songId')?.toString() || '';
          fileContent = formData.get('fileContent');
          contentType = formData.get('contentType')?.toString() || 'application/octet-stream';
          console.log(`Requête ${req.method} (form-data) avec action=${action}, path=${path}, songId=${songId}`);
        }
      } catch (error) {
        console.error('Error parsing request body:', error);
        return new Response(JSON.stringify({ 
          error: 'Invalid request body',
          details: error.message
        }), {
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Action pour uploader un fichier sur Dropbox
    if (action === 'upload' && path && fileContent) {
      try {
        console.log(`Traitement de l'action 'upload' pour le chemin ${path}`);
        const uploadedPath = await uploadToDropbox(fileContent, path, contentType);
        
        return new Response(JSON.stringify({ 
          success: true,
          path: uploadedPath 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error("Erreur lors de l'upload:", error);
        return new Response(JSON.stringify({ 
          error: `Erreur lors de l'upload: ${error.message}` 
        }), {
          status: 500,
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
      
      return await getSharedLink(dropboxPath);
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        // Utiliser la version modifiée de getSharedLink
        const response = await getSharedLink(dropboxPath);
        
        // Si c'est une réponse d'erreur, la renvoyer directement
        if (response.status !== 200) {
          return response;
        }
        
        // Sinon, extraire l'URL et télécharger le contenu
        const responseData = await response.json();
        const url = responseData.url;
        
        // Télécharger le contenu des paroles
        const lyricsResponse = await fetch(url);
        if (!lyricsResponse.ok) {
          throw new Error(`Erreur lors du téléchargement: ${lyricsResponse.status}`);
        }
        
        const lyrics = await lyricsResponse.text();
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
    
    // Vérifier si un fichier existe
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
    return new Response(JSON.stringify({ error: 'Action non supportée ou paramètres manquants' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error(`Erreur serveur: ${error.message}`, error.stack);
    return new Response(JSON.stringify({ 
      error: `Erreur serveur: ${error.message}`,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } finally {
    trackMemory("request-end");
  }
});
