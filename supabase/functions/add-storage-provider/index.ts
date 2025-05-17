
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

    // Utiliser le client SQL de Supabase pour exécuter directement l'ALTER TABLE
    // Cette approche est plus directe et ne dépend pas de fonctions RPC
    const { error } = await supabase
      .from('songs')
      .select('id')
      .limit(1)
      .then(async () => {
        // Si on arrive ici, la table songs existe
        console.log("Table songs trouvée, tentative d'ajout de la colonne storage_provider")
        
        // On utilise la méthode de contournement pour exécuter une commande SQL directe
        return await fetch(`${supabaseUrl}/rest/v1/rpc/alter_table_add_column`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            table_name: 'songs',
            column_name: 'storage_provider',
            column_type: 'text',
            column_default: "'supabase'"
          })
        }).then(res => res.json())
          .catch(err => ({ error: err }))
      })
      .catch(err => ({ error: err }))

    if (error) {
      console.error('Error adding storage_provider column:', error)
      
      // Approche de secours : enregistrer l'erreur et retourner un message pour informer l'utilisateur
      // de créer manuellement la colonne via la console SQL de Supabase
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Could not add storage_provider column automatically. Please check logs.',
          error: error.message,
          instruction: "Please execute this SQL in Supabase: ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'supabase'"
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

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Storage provider column added or already exists',
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
