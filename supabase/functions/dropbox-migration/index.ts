
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

// Fonction pour uploader un fichier vers Dropbox
async function uploadToDropbox(content: Uint8Array, path: string, contentType = 'application/octet-stream') {
  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${dropboxApiKey}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: `/${path}`,
        mode: 'overwrite',
        autorename: true,
        mute: false
      })
    },
    body: content
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.path_display;
}

// Fonction pour migrer un fichier audio
async function migrateAudioFile(file: { id: string; file_path: string }) {
  try {
    // Vérifier d'abord si le fichier existe déjà dans Dropbox
    const exists = await checkFileExists(`audio/${file.id}`);
    if (exists) {
      // Enregistrer la référence
      await supabase
        .from('dropbox_files')
        .upsert({
          local_id: `audio/${file.id}`,
          dropbox_path: `/audio/${file.id}`
        });
      
      return {
        success: true,
        id: file.id
      };
    }
    
    // Télécharger le fichier depuis Supabase
    const { data: fileData, error: fileError } = await supabase.storage
      .from('audio')
      .download(file.file_path || file.id);
    
    if (fileError || !fileData) {
      throw new Error(fileError?.message || 'File not found');
    }
    
    // Uploader vers Dropbox
    const content = new Uint8Array(await fileData.arrayBuffer());
    const dropboxPath = await uploadToDropbox(content, `audio/${file.id}`, fileData.type);
    
    // Enregistrer la référence
    await supabase
      .from('dropbox_files')
      .upsert({
        local_id: `audio/${file.id}`,
        dropbox_path: dropboxPath
      });
    
    return {
      success: true,
      id: file.id,
      path: dropboxPath
    };
  } catch (error) {
    return {
      success: false,
      id: file.id,
      error: error.message
    };
  }
}

// Fonction pour migrer des paroles
async function migrateLyricsFile(lyrics: { song_id: string; content: string }) {
  try {
    // Vérifier d'abord si les paroles existent déjà dans Dropbox
    const exists = await checkFileExists(`lyrics/${lyrics.song_id}`);
    if (exists) {
      // Enregistrer la référence
      await supabase
        .from('dropbox_files')
        .upsert({
          local_id: `lyrics/${lyrics.song_id}`,
          dropbox_path: `/lyrics/${lyrics.song_id}`
        });
      
      return {
        success: true,
        id: lyrics.song_id
      };
    }
    
    // Convertir le contenu en Uint8Array
    const encoder = new TextEncoder();
    const content = encoder.encode(lyrics.content);
    
    // Uploader vers Dropbox
    const dropboxPath = await uploadToDropbox(content, `lyrics/${lyrics.song_id}`, 'text/plain');
    
    // Enregistrer la référence
    await supabase
      .from('dropbox_files')
      .upsert({
        local_id: `lyrics/${lyrics.song_id}`,
        dropbox_path: dropboxPath
      });
    
    return {
      success: true,
      id: lyrics.song_id,
      path: dropboxPath
    };
  } catch (error) {
    return {
      success: false,
      id: lyrics.song_id,
      error: error.message
    };
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
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Analyser la requête
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Méthode non supportée' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const requestData = await req.json();
    
    // Migration de fichiers audio
    if (requestData.type === 'audio' && Array.isArray(requestData.files)) {
      const files = requestData.files;
      const results = {
        success: 0,
        failed: 0,
        failedFiles: [] as Array<{ id: string; error: string }>
      };
      
      // Traiter les fichiers par lots pour éviter un timeout
      const batchSize = 5;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(migrateAudioFile));
        
        batchResults.forEach(result => {
          if (result.success) {
            results.success++;
          } else {
            results.failed++;
            results.failedFiles.push({
              id: result.id,
              error: result.error
            });
          }
        });
      }
      
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Migration des paroles
    if (requestData.type === 'lyrics') {
      // Récupérer les paroles
      const { data: lyrics, error } = await supabase
        .from('lyrics')
        .select('song_id, content');
      
      if (error) {
        throw new Error(`Erreur lors de la récupération des paroles: ${error.message}`);
      }
      
      const results = {
        success: 0,
        failed: 0,
        failedItems: [] as Array<{ id: string; error: string }>,
        totalCount: lyrics?.length || 0
      };
      
      if (!lyrics || lyrics.length === 0) {
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Traiter les paroles par lots pour éviter un timeout
      const batchSize = 10;
      for (let i = 0; i < lyrics.length; i += batchSize) {
        const batch = lyrics.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(migrateLyricsFile));
        
        batchResults.forEach(result => {
          if (result.success) {
            results.success++;
          } else {
            results.failed++;
            results.failedItems.push({
              id: result.id,
              error: result.error
            });
          }
        });
      }
      
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Type de migration non supporté' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: `Erreur serveur: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
