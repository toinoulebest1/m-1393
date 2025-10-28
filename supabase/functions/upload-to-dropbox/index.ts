import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { file, path, accessToken } = await req.json();
    
    if (!file || !path || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'file, path, and accessToken are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading file to Dropbox: ${path}`);

    // Decode base64 file
    const fileData = Uint8Array.from(atob(file), c => c.charCodeAt(0));

    // Upload to Dropbox
    const dropboxResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: path,
          mode: 'overwrite',
          autorename: true,
          mute: false
        })
      },
      body: fileData
    });

    if (!dropboxResponse.ok) {
      const errorText = await dropboxResponse.text();
      console.error('Dropbox upload error:', dropboxResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Dropbox upload failed: ${dropboxResponse.status}`,
          details: errorText
        }),
        { status: dropboxResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await dropboxResponse.json();
    console.log('✅ File uploaded to Dropbox:', data.path_display);

    // Store reference in database
    const { error: dbError } = await supabase
      .from('dropbox_files')
      .upsert({
        local_id: path,
        dropbox_path: data.path_display || path
      });

    if (dbError) {
      console.error('Database error:', dbError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        path: data.path_display || path
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error uploading to Dropbox:', error);
    
    return new Response(
      JSON.stringify({ 
        error: "Erreur lors de l'upload vers Dropbox",
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
