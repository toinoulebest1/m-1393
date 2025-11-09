import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { songTitle, artist, duration, albumName } = await req.json()

  console.log(`Recherche de paroles pour: ${songTitle} par ${artist}`)

  try {
    let apiUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(songTitle)}&artist_name=${encodeURIComponent(artist)}`
    if (albumName) {
      apiUrl += `&album_name=${encodeURIComponent(albumName)}`
    }
    if (duration) {
      apiUrl += `&duration=${duration}`
    }

    console.log("Appel à l'API LRCLIB:", apiUrl)

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`Erreur de l'API LRCLIB: ${response.statusText}`)
    }

    const data = await response.json()
    console.log("Réponse de LRCLIB:", data)

    if (data && data.length > 0) {
      const bestMatch = data[0]
      const lyrics = bestMatch.syncedLyrics || bestMatch.plainLyrics

      if (lyrics) {
        console.log("Paroles trouvées via LRCLIB")
        return new Response(
          JSON.stringify({ 
            lyrics: bestMatch.plainLyrics,
            syncedLyrics: bestMatch.syncedLyrics 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log("Aucune parole trouvée sur LRCLIB")
    return new Response(
      JSON.stringify({ error: 'Paroles non trouvées sur LRCLIB' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("Erreur lors de la récupération des paroles:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})