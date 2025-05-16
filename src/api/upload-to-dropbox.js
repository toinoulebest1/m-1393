
// API endpoint pour le téléchargement direct de fichiers vers Dropbox
// Cette approche contourne les limites de mémoire des edge functions

import { supabase } from '@/integrations/supabase/client';

export async function onRequest(context) {
  // Vérifier la méthode
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Récupérer le chemin depuis les query params
    const url = new URL(context.request.url);
    const path = url.searchParams.get('path');
    
    if (!path) {
      return new Response(JSON.stringify({ error: 'Chemin manquant' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Récupérer le fichier depuis le FormData
    const formData = await context.request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'Fichier manquant' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // Redirection vers l'edge function Dropbox Storage pour les fichiers volumineux
    const newFormData = new FormData();
    newFormData.append('action', 'upload');
    newFormData.append('path', path);
    newFormData.append('fileContent', file);
    newFormData.append('contentType', file.type || 'application/octet-stream');
    
    // Appel à l'edge function Dropbox Storage
    const dropboxResponse = await fetch('https://pwknncursthenghqgevl.functions.supabase.co/dropbox-storage', {
      method: 'POST',
      body: newFormData,
      headers: {
        // Transférer l'autorisation si disponible
        ...(context.request.headers.get('Authorization') ? {
          'Authorization': context.request.headers.get('Authorization')
        } : {})
      }
    });
    
    if (!dropboxResponse.ok) {
      const error = await dropboxResponse.text();
      throw new Error(`Upload error: ${dropboxResponse.status} - ${error}`);
    }
    
    const data = await dropboxResponse.json();
    
    return new Response(JSON.stringify({ 
      success: true,
      path: data.path || data.path_display
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error("Erreur lors du traitement de l'upload:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
