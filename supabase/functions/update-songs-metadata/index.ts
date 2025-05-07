
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    // Déterminer le mode de mise à jour
    const { mode = 'all', songId } = await req.json();
    console.log(`Mode de mise à jour: ${mode}${songId ? `, Chanson ID: ${songId}` : ''}`);

    // Récupérer les chansons à mettre à jour
    let songsToUpdate = [];
    
    if (mode === 'single' && songId) {
      // Mise à jour d'une seule chanson
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', songId)
        .limit(1);
      
      if (error) throw error;
      songsToUpdate = data || [];
    } else {
      // Mise à jour de toutes les chansons
      const { data, error } = await supabase
        .from('songs')
        .select('*');
      
      if (error) throw error;
      songsToUpdate = data || [];
    }

    console.log(`Nombre de chansons à mettre à jour: ${songsToUpdate.length}`);

    // Traiter chaque chanson
    const results = [];
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const song of songsToUpdate) {
      try {
        // Construire la requête de recherche
        const searchQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        console.log(`Recherche pour: ${song.title} - ${song.artist}`);

        // Appeler l'API Deezer via notre fonction edge
        const deezerResponse = await fetch(`https://pwknncursthenghqgevl.supabase.co/functions/v1/deezer-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || ''}`
          },
          body: JSON.stringify({ query: searchQuery })
        });

        if (!deezerResponse.ok) {
          throw new Error(`Erreur API Deezer: ${deezerResponse.status}`);
        }

        const deezerData = await deezerResponse.json();
        
        // Vérifier si nous avons des résultats
        if (!deezerData.data || deezerData.data.length === 0) {
          console.log(`Aucun résultat trouvé pour: ${song.title}`);
          results.push({
            id: song.id,
            status: 'skipped',
            reason: 'Aucun résultat trouvé'
          });
          skippedCount++;
          continue;
        }

        // Utiliser le premier résultat
        const match = deezerData.data[0];
        
        // Préparer les données à mettre à jour
        const updateData: any = {};
        
        // Ajouter la pochette si non existante
        if ((!song.image_url || song.image_url.includes('picsum.photos')) && match.album?.cover_xl) {
          updateData.image_url = match.album.cover_xl;
        }
        
        // Ajouter l'artiste si non existant
        if (!song.artist && match.artist?.name) {
          updateData.artist = match.artist.name;
        }
        
        // Ajouter le genre si non existant
        if (!song.genre && match.album?.genres?.data?.[0]?.name) {
          updateData.genre = match.album.genres.data[0].name;
        }
        
        // Ajouter la durée si non existante
        if ((!song.duration || song.duration === '0:00') && match.duration) {
          const minutes = Math.floor(match.duration / 60);
          const seconds = match.duration % 60;
          updateData.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Si aucune donnée à mettre à jour
        if (Object.keys(updateData).length === 0) {
          console.log(`Pas de mise à jour nécessaire pour: ${song.title}`);
          results.push({
            id: song.id,
            status: 'skipped',
            reason: 'Pas de nouvelles données'
          });
          skippedCount++;
          continue;
        }
        
        // Mettre à jour la chanson
        console.log(`Mise à jour de: ${song.title}`, updateData);
        const { error: updateError } = await supabase
          .from('songs')
          .update(updateData)
          .eq('id', song.id);
        
        if (updateError) throw updateError;
        
        results.push({
          id: song.id,
          status: 'updated',
          updatedFields: Object.keys(updateData)
        });
        updatedCount++;
        
      } catch (error) {
        console.error(`Erreur pour la chanson ${song.id} (${song.title}):`, error);
        results.push({
          id: song.id,
          status: 'error',
          reason: error.message
        });
        errorCount++;
      }
    }

    // Résumé des opérations
    const summary = {
      total: songsToUpdate.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      details: results
    };

    console.log('Résumé:', JSON.stringify(summary, null, 2));
    
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Erreur générale:', error);
    
    return new Response(JSON.stringify({ 
      error: true, 
      message: error.message 
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
