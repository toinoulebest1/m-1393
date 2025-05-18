
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.searchParams.get('path')
    
    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Path parameter is required' }), 
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }
    
    // Construct Deezer API URL
    const deezerApiUrl = `https://api.deezer.com${path}`
    
    console.log(`Fetching from Deezer API: ${deezerApiUrl}`)
    
    const response = await fetch(deezerApiUrl)
    
    if (!response.ok) {
      throw new Error(`Deezer API responded with ${response.status}: ${await response.text()}`)
    }
    
    const data = await response.json()
    
    return new Response(
      JSON.stringify(data),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    console.error("Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
