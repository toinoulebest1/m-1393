
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q')
    
    if (!query) {
      return new Response('Query parameter is required', { status: 400 })
    }

    const deezerResponse = await fetch(`https://api.deezer.com/search?q=${query}`)
    const data = await deezerResponse.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
