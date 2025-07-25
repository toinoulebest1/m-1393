import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { dropboxPath, localId, accessToken } = await req.json();
    
    if (!dropboxPath || !localId || !accessToken) {
      return new Response(
        JSON.stringify({ 
          error: 'dropboxPath, localId, and accessToken are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Generating shared link for:', dropboxPath);

    // Create shared link using Dropbox API
    const dropboxResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: dropboxPath,
        settings: {
          requested_visibility: 'public'
        }
      })
    });

    let sharedLink = null;

    if (dropboxResponse.ok) {
      const data = await dropboxResponse.json();
      sharedLink = data.url;
      console.log('✅ Shared link created:', sharedLink);
    } else if (dropboxResponse.status === 409) {
      // Link already exists, get the existing one
      console.log('Link already exists, fetching existing link...');
      
      const listResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: dropboxPath
        })
      });

      if (listResponse.ok) {
        const listData = await listResponse.json();
        if (listData.links && listData.links.length > 0) {
          sharedLink = listData.links[0].url;
          console.log('✅ Existing shared link retrieved:', sharedLink);
        }
      }
    }

    if (!sharedLink) {
      throw new Error('Failed to create or retrieve shared link');
    }

    // Convert to direct download URL
    const directUrl = sharedLink.replace('dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');

    // Save to database avec upsert corrigé
    const { data, error } = await supabase
      .from('dropbox_files')
      .upsert({
        local_id: localId,
        dropbox_path: dropboxPath,
        shared_link: directUrl,
        link_created_at: new Date().toISOString(),
        // Links don't expire for personal Dropbox accounts
        link_expires_at: null
      }, {
        onConflict: 'local_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('✅ Shared link saved to database for:', localId);

    return new Response(
      JSON.stringify({ 
        success: true,
        sharedLink: directUrl,
        localId: localId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error generating shared link:', error);
    
    return new Response(
      JSON.stringify({ 
        error: "Erreur lors de la génération du lien partagé",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});