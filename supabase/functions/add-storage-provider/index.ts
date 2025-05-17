
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Essayer d'ajouter directement la colonne storage_provider si elle n'existe pas
    // au lieu d'utiliser la fonction SQL qui cause des problèmes de cache
    const { error: checkColumnError } = await supabase.rpc(
      'check_column_exists',
      { table_name: 'songs', column_name: 'storage_provider' }
    )
    
    let columnAdded = false
    
    if (checkColumnError) {
      console.log("Error checking column:", checkColumnError)
      // La fonction RPC n'existe peut-être pas, essayons de façon alternative
      // en exécutant directement l'alter table
      const { error: alterError } = await supabase.rpc(
        'exec_sql', 
        { sql: "ALTER TABLE IF NOT EXISTS public.songs ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'supabase'" }
      )
      
      if (alterError) {
        console.error('Error adding storage_provider column directly:', alterError)
        throw alterError
      }
      
      columnAdded = true
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Storage provider column added successfully',
        columnAdded
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
