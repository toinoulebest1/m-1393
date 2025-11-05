import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Vérifier que l'utilisateur est authentifié
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      console.error('❌ Erreur authentification:', authError)
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ Utilisateur authentifié:', user.id)

    // Vérifier que l'utilisateur est admin
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc(
      'is_admin',
      { user_id: user.id }
    )

    if (adminError || !isAdmin) {
      console.error('❌ Utilisateur non admin:', user.id)
      return new Response(
        JSON.stringify({ error: 'Accès refusé - Admin uniquement' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('🔑 Admin vérifié, démarrage de la purge...')

    // Compter le nombre d'entrées avant suppression
    const { count: totalCount, error: countError } = await supabaseClient
      .from('play_history')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('❌ Erreur lors du comptage:', countError)
      throw countError
    }

    console.log(`📊 Nombre d'entrées à supprimer: ${totalCount}`)

    // Supprimer toutes les entrées de l'historique
    const { error: deleteError } = await supabaseClient
      .from('play_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Condition qui matche tout

    if (deleteError) {
      console.error('❌ Erreur lors de la suppression:', deleteError)
      throw deleteError
    }

    console.log('✅ Purge de l\'historique terminée avec succès')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Historique purgé avec succès',
        deletedCount: totalCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Erreur lors de la purge de l\'historique:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
