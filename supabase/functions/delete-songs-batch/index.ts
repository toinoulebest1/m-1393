
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
    const { songIds } = await req.json()
    
    if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'songIds array is required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let deletedCount = 0
    const errors: string[] = []

    // Traitement par batch pour éviter les timeout
    const BATCH_SIZE = 5
    for (let i = 0; i < songIds.length; i += BATCH_SIZE) {
      const batch = songIds.slice(i, i + BATCH_SIZE)
      
      // Suppression parallèle du batch
      const promises = batch.map(async (songId: string) => {
        try {
          const { data, error } = await supabase.rpc('delete_song_completely', {
            song_id_param: songId
          })
          
          if (error) {
            throw error
          }
          
          if (data) {
            return { success: true, songId }
          } else {
            return { success: false, songId, error: 'Suppression échouée' }
          }
        } catch (error) {
          return { success: false, songId, error: error.message }
        }
      })
      
      const results = await Promise.all(promises)
      
      // Compter les succès et erreurs
      results.forEach(result => {
        if (result.success) {
          deletedCount++
        } else {
          errors.push(`${result.songId}: ${result.error}`)
        }
      })
      
      // Petite pause entre les batches
      if (i + BATCH_SIZE < songIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return new Response(
      JSON.stringify({ 
        deletedCount,
        totalRequested: songIds.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Error in delete-songs-batch:', error)
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
