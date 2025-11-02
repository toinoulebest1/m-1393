
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { query, limit = 25, index = 0 } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Searching Deezer for:", query, "with limit:", limit, "index:", index);
    
    const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&index=${index}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`Deezer API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Deezer search results:", data.data?.length || 0, "tracks returned (", data.total, "total matches)");

    // Enrichir chaque piste avec la liste complète des contributeurs (artistes)
    try {
      const tracks = Array.isArray(data.data) ? data.data : [];
      const concurrency = 5;

      const fetchWithContributors = async (track: any) => {
        try {
          const detailRes = await fetch(`https://api.deezer.com/track/${track.id}`);
          if (!detailRes.ok) return track;
          const detail = await detailRes.json();

          if (detail && Array.isArray(detail.contributors) && detail.contributors.length > 0) {
            // Ajouter les contributeurs et des champs pratiques pour le front
            const contributorNames = detail.contributors
              .map((c: any) => c?.name)
              .filter((n: any) => typeof n === 'string' && n.trim().length > 0);

            const mainArtist = track?.artist?.name;
            const unique = new Set<string>();
            if (mainArtist) unique.add(mainArtist);
            for (const n of contributorNames) unique.add(n);

            // Champs auxiliaires non intrusifs pour l'UI
            (track as any).contributors = detail.contributors;
            (track as any)._contributors_names = Array.from(unique);
            (track as any)._artist_combined = Array.from(unique).join(' & ');
          }
        } catch (e) {
          console.warn('Failed to enrich track with contributors', track?.id, e);
        }
        return track;
      };

      const resultsWithContrib: any[] = [];
      for (let i = 0; i < tracks.length; i += concurrency) {
        const slice = tracks.slice(i, i + concurrency);
        const enriched = await Promise.all(slice.map(fetchWithContributors));
        resultsWithContrib.push(...enriched);
      }

      data.data = resultsWithContrib;
    } catch (e) {
      console.warn('Contributor enrichment failed:', e);
    }
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in Deezer search function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
