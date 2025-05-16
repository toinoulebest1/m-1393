
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
    const { songs } = await req.json()
    const updatedItems = []
    let updated = 0
    let errors = 0
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    for (const song of songs) {
      try {
        console.log(`Processing song: ${song.id} - ${song.title} by ${song.artist}`)
        
        // ---- PREMIÈRE STRATÉGIE: Recherche avec les informations disponibles ----
        let searchQuery = ""
        
        // Si l'artiste est connu, on l'utilise avec le titre
        if (song.artist && song.artist !== "Unknown Artist") {
          searchQuery = `${song.artist} ${song.title}` 
        } 
        // Si le titre contient des informations sur l'artiste (comme "Artiste - Titre")
        else if (song.title && song.title.includes(' - ')) {
          searchQuery = song.title
        } 
        // Utiliser simplement le titre en dernier recours
        else {
          searchQuery = song.title
        }
        
        console.log(`Trying initial search with query: ${searchQuery}`)
        let response = await fetch(
          `https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}`
        )
        
        if (!response.ok) {
          console.error(`Deezer API error: ${response.status} ${response.statusText}`)
          throw new Error(`Deezer API error: ${response.status}`)
        }
        
        let data = await response.json()
        let results = data.data || []

        // Si aucun résultat n'a été trouvé, essayez avec juste le titre
        if (results.length === 0 && song.title) {
          const titleOnlyQuery = song.title.split(' - ').pop()?.trim() || song.title
          console.log(`No results found. Trying with title only: ${titleOnlyQuery}`)
          
          response = await fetch(
            `https://api.deezer.com/search?q=${encodeURIComponent(titleOnlyQuery)}`
          )
          
          if (response.ok) {
            data = await response.json()
            results = data.data || []
          }
        }
        
        // ---- TRAITEMENT DES RÉSULTATS ----
        if (results.length > 0) {
          // Essayer de trouver la meilleure correspondance basée sur la durée (si disponible)
          let bestMatch = results[0]
          
          if (song.duration) {
            // Extraire le temps en secondes du format "mm:ss"
            const durationParts = song.duration.split(':')
            const songDurationSecs = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1] || '0')
            
            // Chercher la correspondance la plus proche en termes de durée
            let closestDurationDiff = Math.abs(results[0].duration - songDurationSecs)
            
            for (const result of results) {
              const durationDiff = Math.abs(result.duration - songDurationSecs)
              if (durationDiff < closestDurationDiff) {
                closestDurationDiff = durationDiff
                bestMatch = result
              }
            }
            
            console.log(`Found best match by duration: ${bestMatch.artist?.name} - ${bestMatch.title}`)
          }
          
          const track = bestMatch
          const songUpdates = {}
          
          // Mettre à jour uniquement si nous avons de meilleures données
          if ((!song.image_url || song.image_url.includes('picsum')) && track.album?.cover_xl) {
            songUpdates.image_url = track.album.cover_xl
          }
          
          // Mettre à jour l'artiste si inconnu ou vide
          if ((!song.artist || song.artist === "Unknown Artist") && track.artist?.name) {
            songUpdates.artist = track.artist.name
          }
          
          if (!song.genre && track.album?.genre_id) {
            songUpdates.genre = String(track.album.genre_id)
          }
          
          if (!song.duration && track.duration) {
            const minutes = Math.floor(track.duration / 60)
            const seconds = track.duration % 60
            songUpdates.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`
          }
          
          // Si le titre contient potentiellement des métadonnées (comme "Artiste - Titre")
          // et que nous avons trouvé un meilleur titre via Deezer, le mettre à jour
          if (song.title.includes(' - ') && track.title) {
            // Ne mettre à jour que si le titre de Deezer n'est pas trop générique
            if (track.title.length > 3) {
              songUpdates.title = track.title
            }
          }
          
          if (Object.keys(songUpdates).length > 0) {
            const { error: updateError } = await supabase
              .from('songs')
              .update(songUpdates)
              .eq('id', song.id)
              
            if (updateError) {
              console.error(`Error updating song ${song.id}:`, updateError)
              errors++
            } else {
              console.log(`Updated song: ${song.id} with metadata:`, songUpdates)
              updated++
              updatedItems.push({
                id: song.id,
                title: song.title,
                updates: Object.keys(songUpdates)
              })
            }
          } else {
            console.log(`No updates needed for song: ${song.id}`)
          }
        } else {
          console.log(`No results found for any search strategy: ${searchQuery}`)
        }
        
        // Ajouter un petit délai pour éviter les limitations de taux
        await new Promise(resolve => setTimeout(resolve, 300))
        
      } catch (error) {
        console.error(`Error processing song ${song.id}:`, error)
        errors++
      }
    }
    
    return new Response(
      JSON.stringify({ 
        updated, 
        errors, 
        updates: updatedItems 
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
