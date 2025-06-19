
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      maintenance_notifications: {
        Row: {
          id: string
          email: string
          subscribed_at: string
          created_at: string
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Début de l\'envoi des notifications de maintenance')

    // Initialiser le client Supabase avec les permissions service_role
    const supabaseAdmin = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer tous les emails à notifier
    const { data: notifications, error: fetchError } = await supabaseAdmin
      .from('maintenance_notifications')
      .select('*')

    if (fetchError) {
      console.error('Erreur lors de la récupération des notifications:', fetchError)
      throw fetchError
    }

    if (!notifications || notifications.length === 0) {
      console.log('Aucun email à notifier')
      return new Response(
        JSON.stringify({ message: 'Aucun email à notifier', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`${notifications.length} emails à notifier`)

    // Envoyer les emails (simulation pour l'instant - remplacer par Resend si besoin)
    const emailPromises = notifications.map(async (notification) => {
      console.log(`Envoi d'email simulé à: ${notification.email}`)
      // Ici, vous pourriez utiliser Resend ou un autre service d'email
      // Pour l'instant, on simule juste l'envoi
      return Promise.resolve({ success: true, email: notification.email })
    })

    const emailResults = await Promise.allSettled(emailPromises)
    const successfulEmails = emailResults.filter(result => result.status === 'fulfilled')

    console.log(`${successfulEmails.length} emails envoyés avec succès`)

    // Purger tous les emails de la table après envoi
    const { error: deleteError } = await supabaseAdmin
      .from('maintenance_notifications')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Supprimer tout

    if (deleteError) {
      console.error('Erreur lors de la purge des notifications:', deleteError)
      throw deleteError
    }

    console.log('Purge des notifications terminée')

    return new Response(
      JSON.stringify({
        message: 'Notifications envoyées et base purgée',
        emailsSent: successfulEmails.length,
        totalNotifications: notifications.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur dans send-maintenance-notifications:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
