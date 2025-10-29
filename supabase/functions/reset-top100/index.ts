import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FavoriteStat {
  song_id: string;
  user_id: string;
  count: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting Top 100 reset process...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(now.getDate() - 15); // 15 jours avant

    console.log(`📅 Period: ${periodStart.toISOString()} to ${now.toISOString()}`);

    // 1. Récupérer toutes les stats actuelles
    const { data: currentStats, error: fetchError } = await supabaseClient
      .from('favorite_stats')
      .select('song_id, user_id, count');

    if (fetchError) {
      console.error('❌ Error fetching current stats:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${currentStats?.length || 0} favorite stats to archive`);

    // 2. Archiver les données actuelles
    if (currentStats && currentStats.length > 0) {
      const archiveData = currentStats.map((stat: FavoriteStat) => ({
        song_id: stat.song_id,
        user_id: stat.user_id,
        count: stat.count,
        period_start: periodStart.toISOString(),
        period_end: now.toISOString(),
      }));

      const { error: archiveError } = await supabaseClient
        .from('favorite_stats_archive')
        .insert(archiveData);

      if (archiveError) {
        console.error('❌ Error archiving stats:', archiveError);
        throw archiveError;
      }

      console.log('✅ Stats archived successfully');
    }

    // 3. Supprimer toutes les entrées de favorite_stats
    const { error: deleteError } = await supabaseClient
      .from('favorite_stats')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('❌ Error deleting stats:', deleteError);
      throw deleteError;
    }

    console.log('✅ All favorite stats deleted');

    // 4. Enregistrer l'historique de reset
    const { error: historyError } = await supabaseClient
      .from('top100_reset_history')
      .insert({
        songs_archived: currentStats?.length || 0,
        period_start: periodStart.toISOString(),
        period_end: now.toISOString(),
      });

    if (historyError) {
      console.error('❌ Error recording reset history:', historyError);
      throw historyError;
    }

    console.log('✅ Reset history recorded');

    const response = {
      success: true,
      message: 'Top 100 reset successfully',
      stats: {
        songsArchived: currentStats?.length || 0,
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
      },
    };

    console.log('✅ Top 100 reset completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Error in reset-top100 function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
