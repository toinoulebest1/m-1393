
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
        
        // Determine what to search for in the Deezer API
        let searchQuery = ""
        
        // If artist is known, use it with title
        if (song.artist && song.artist !== "Unknown Artist") {
          searchQuery = `${song.artist} ${song.title}` 
        } 
        // If title contains artist information (like "Artist - Title")
        else if (song.title && song.title.includes(' - ')) {
          searchQuery = song.title
        } 
        // Just use the title as a last resort
        else {
          searchQuery = song.title
        }
        
        const response = await fetch(
          `https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}`
        )
        
        if (!response.ok) {
          console.error(`Deezer API error: ${response.status} ${response.statusText}`)
          throw new Error(`Deezer API error: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.data && data.data.length > 0) {
          const track = data.data[0]
          const songUpdates = {}
          
          // Only update if we have better data
          if ((!song.image_url || song.image_url.includes('picsum')) && track.album?.cover_xl) {
            songUpdates.image_url = track.album.cover_xl
          }
          
          // Update artist if unknown or empty
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
          
          // If the title is potentially generic or contains metadata (like "Artist - Title")
          // and we found a better title from Deezer, update it
          if (song.title.includes(' - ') && track.title) {
            // Only update if the Deezer title isn't too generic
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
              console.log(`Updated song: ${song.id} with:`, songUpdates)
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
          console.log(`No results found for: ${searchQuery}`)
        }
        
        // Add a small delay to avoid rate limiting
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
