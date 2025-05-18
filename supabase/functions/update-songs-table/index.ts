
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Vérifier si la colonne existe déjà
    const { data: columns, error: columnCheckError } = await supabase.rpc('schema_info', {
      table_name: 'songs',
      schema_name: 'public'
    })
    
    if (columnCheckError) {
      return new Response(
        JSON.stringify({ 
          error: columnCheckError.message,
          step: "column_check" 
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
    
    // Vérifier si la colonne storage_provider existe déjà
    const columnExists = columns.some(col => col.column_name === 'storage_provider')
    
    if (!columnExists) {
      // Ajouter la colonne storage_provider
      const { error: alterTableError } = await supabase.rpc('execute_sql', {
        sql: 'ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT \'supabase\''
      })
      
      if (alterTableError) {
        return new Response(
          JSON.stringify({ 
            error: alterTableError.message,
            step: "alter_table"
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
          message: 'Colonne storage_provider ajoutée à la table songs'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'La colonne storage_provider existe déjà'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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
