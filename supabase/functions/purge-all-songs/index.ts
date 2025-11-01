import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🚨 PURGE COMPLÈTE : Récupération de TOUTES les chansons...');

    // Récupérer TOUTES les chansons
    const { data: songs, error: fetchError } = await supabaseClient
      .from('songs')
      .select('id, title, artist')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Erreur récupération chansons:', fetchError);
      throw fetchError;
    }

    if (!songs || songs.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Aucune chanson à supprimer',
          deleted_count: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    console.log(`🗑️ PURGE COMPLÈTE : Suppression de ${songs.length} chansons...`);

    let deletedCount = 0;
    const errors: string[] = [];
    const batchSize = 10;

    // Traiter par lots de 10 pour éviter les timeouts
    for (let i = 0; i < songs.length; i += batchSize) {
      const batch = songs.slice(i, i + batchSize);
      
      // Traiter le lot en parallèle
      const batchPromises = batch.map(async (song) => {
        try {
          console.log(`Suppression: ${song.title} - ${song.artist}`);
          
          const { error: deleteError } = await supabaseClient
            .rpc('delete_song_completely', { song_id_param: song.id });

          if (deleteError) {
            console.error(`Erreur suppression ${song.id}:`, deleteError);
            errors.push(`${song.title}: ${deleteError.message}`);
            return false;
          } else {
            console.log(`✅ Chanson supprimée: ${song.title}`);
            return true;
          }
        } catch (error) {
          console.error(`Erreur traitement ${song.id}:`, error);
          errors.push(`${song.title}: ${error.message}`);
          return false;
        }
      });

      const results = await Promise.all(batchPromises);
      deletedCount += results.filter(r => r).length;

      // Petit délai entre les lots
      if (i + batchSize < songs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ PURGE COMPLÈTE TERMINÉE: ${deletedCount}/${songs.length} chansons supprimées`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedCount,
        total_songs: songs.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Erreur:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        deleted_count: 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
})
