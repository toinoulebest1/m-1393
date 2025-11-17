import { createHash, createCipheriv } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLOWFISH_SECRET = "g4el58wc0zvf9na1";

// Génération de la clé Blowfish (EXACTEMENT comme Python)
function generateBlowfishKey(trackId: string): Uint8Array {
  const md5Hash = createHash('md5').update(trackId).digest('hex');
  const key = [];
  
  for (let i = 0; i < 16; i++) {
    const char1 = md5Hash.charCodeAt(i);
    const char2 = md5Hash.charCodeAt(i + 16);
    const char3 = BLOWFISH_SECRET.charCodeAt(i);
    key.push(char1 ^ char2 ^ char3);
  }
  
  return new Uint8Array(key);
}

// Déchiffrement Blowfish CBC (EXACTEMENT comme Python)
function decryptChunk(key: Uint8Array, data: Uint8Array): Uint8Array {
  const iv = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
  const decipher = createCipheriv('bf-cbc', key, iv);
  decipher.setAutoPadding(false);
  
  const decrypted = new Uint8Array(data.length);
  const part1 = decipher.update(data);
  part1.copy(decrypted, 0);
  
  return decrypted;
}

// Génération URL chiffrée (EXACTEMENT comme Python)
function getEncryptedFileUrl(metaId: string, trackHash: string, mediaVersion: string): string {
  const formatNumber = 1;
  
  const urlBytes = [
    trackHash,
    String(formatNumber),
    String(metaId),
    String(mediaVersion)
  ].join('\xa4');
  
  const urlHash = createHash('md5').update(urlBytes, 'utf8').digest('hex');
  
  let infoBytes = urlHash + '\xa4' + urlBytes + '\xa4';
  const paddingLen = 16 - (infoBytes.length % 16);
  infoBytes += '.'.repeat(paddingLen);
  
  const cipher = createCipheriv('aes-128-ecb', 'jo6aey6haid2Teih', null);
  cipher.setAutoPadding(false);
  const encrypted = cipher.update(infoBytes, 'utf8');
  const path = Buffer.from(encrypted).toString('hex');
  
  return `https://e-cdns-proxy-${trackHash[0]}.dzcdn.net/mobile/1/${path}`;
}

// Appel API Deezer Gateway (EXACTEMENT comme Python)
async function deezerGwApiCall(arl: string, method: string, params: any = {}, apiToken: string = 'null'): Promise<any> {
  const response = await fetch('https://www.deezer.com/ajax/gw-light.php', {
    method: 'POST',
    headers: {
      'Cookie': `arl=${arl}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_version: '1.0',
      api_token: apiToken,
      input: '3',
      method,
      params,
    }),
  });
  
  const data = await response.json();
  console.log(`[Deezer GW API] Method: ${method}, ok=${!!data?.results}, hasError=${!!data?.error}`);
  return data.results;
}

// Récupération du token API et du license_token (mis en cache)
let cachedUserData: { apiToken: string; licenseToken: string; fetchedAt: number } | null = null;
async function getUserData(arl: string): Promise<{ apiToken: string; licenseToken: string }> {
  if (cachedUserData && Date.now() - cachedUserData.fetchedAt < 10 * 60 * 1000) {
    return { apiToken: cachedUserData.apiToken, licenseToken: cachedUserData.licenseToken };
  }
  const res = await fetch('https://www.deezer.com/ajax/gw-light.php', {
    method: 'POST',
    headers: { 'Cookie': `arl=${arl}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_version: '1.0', api_token: 'null', input: '3', method: 'deezer.getUserData', params: {} })
  });
  const data = await res.json();
  const apiToken = data?.results?.checkForm || data?.results?.CHECKFORM || null;
  const licenseToken = data?.results?.USER?.LICENSE_TOKEN || '';
  console.log(`[Deezer UserData] apiToken=${apiToken ? 'ok' : 'missing'} license=${licenseToken ? 'ok' : 'missing (using fallback)'}`);
  if (!apiToken) throw new Error('Deezer API token introuvable');
  // Le license token n'est pas obligatoire, on utilisera la méthode chiffrée en fallback
  cachedUserData = { apiToken, licenseToken, fetchedAt: Date.now() };
  return { apiToken, licenseToken };
}

// Récupération token track (EXACTEMENT comme Python)
async function getTrackToken(arl: string, trackToken: string, licenseToken: string): Promise<string> {
  const response = await fetch('https://media.deezer.com/v1/get_url', {
    method: 'POST',
    headers: {
      'Cookie': `arl=${arl}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      track_tokens: [trackToken],
      license_token: licenseToken,
      media: [{
        type: 'FULL',
        formats: [
          { cipher: 'BF_CBC_STRIPE', format: 'FLAC' },
          { cipher: 'BF_CBC_STRIPE', format: 'MP3_320' },
          { cipher: 'BF_CBC_STRIPE', format: 'MP3_128' }
        ]
      }]
    }),
  });
  
  const data = await response.json();
  return data.data?.[0]?.media?.[0]?.sources?.[0]?.url || null;
}

// Téléchargement info track (EXACTEMENT comme Python)
async function getTrackDownloadInfo(arl: string, trackId: string, quality: number = 2): Promise<any> {
  console.log(`[Deezer] Getting download info for track ${trackId}, quality ${quality}`);
  
  // Récupérer les tokens nécessaires
  const { apiToken, licenseToken } = await getUserData(arl);
  
  // Utiliser song.getData avec apiToken
  const trackInfo = await deezerGwApiCall(arl, 'song.getData', { sng_id: trackId }, apiToken);
  
  // Vérification de la structure de la réponse
  if (!trackInfo || !trackInfo.SNG_ID) {
    console.error('[Deezer] Invalid trackInfo structure:', JSON.stringify(trackInfo));
    throw new Error(`No track data found for track ${trackId}`);
  }
  
  const track = trackInfo;
  
  const fallbackId = track?.FALLBACK?.SNG_ID;
  
  const qualityMap = [
    { quality: 9, format: 'MP3_128', key: 'FILESIZE_MP3_128' },
    { quality: 3, format: 'MP3_320', key: 'FILESIZE_MP3_320' },
    { quality: 1, format: 'FLAC', key: 'FILESIZE_FLAC' },
  ];
  
  const sizeMap = qualityMap.map(q => parseInt(track[q.key] || '0', 10));
  
  // Fallback à une qualité inférieure si nécessaire
  while (sizeMap[quality] === 0 && quality > 0) {
    console.log(`[Deezer] Quality ${quality} not available, falling back to ${quality - 1}`);
    quality--;
  }
  
  const selectedQuality = qualityMap[quality];
  const token = track.TRACK_TOKEN;
  
  let url = null;
  // Essayer d'obtenir l'URL via le token seulement si on a un license token
  if (licenseToken && token) {
    try {
      url = await getTrackToken(arl, token, licenseToken);
      console.log('[Deezer] Got URL via token method');
    } catch (error) {
      console.log('[Deezer] Failed to get URL with token, using encryption method');
    }
  } else {
    console.log('[Deezer] No license token, using encryption method directly');
  }
  
  if (!url) {
    url = getEncryptedFileUrl(
      trackId,
      track.MD5_ORIGIN,
      track.MEDIA_VERSION
    );
  }
  
  return {
    url,
    quality,
    format: selectedQuality.format,
    title: track.SNG_TITLE,
    artist: track.ART_NAME,
    album: track.ALB_TITLE,
    id: trackId,
    isEncrypted: /\/m(obile|edia)\//.test(url),
  };
}

// Streaming avec déchiffrement (EXACTEMENT comme Python)
async function streamTrack(downloadInfo: any): Promise<Response> {
  console.log(`[Deezer] Streaming track from ${downloadInfo.url}`);
  
  const response = await fetch(downloadInfo.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:83.0) Gecko/20100101 Firefox/83.0',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status}`);
  }
  
  const contentLength = response.headers.get('content-length');
  
  // Si non chiffré, streamer directement
  if (!downloadInfo.isEncrypted) {
    console.log('[Deezer] Track not encrypted, streaming directly');
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': downloadInfo.format === 'FLAC' ? 'audio/flac' : 'audio/mpeg',
        'Content-Length': contentLength || '',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      },
    });
  }
  
  // Si chiffré, déchiffrer chunk par chunk
  console.log('[Deezer] Track encrypted, decrypting...');
  const blowfishKey = generateBlowfishKey(downloadInfo.id);
  const ENCRYPT_CHUNK_SIZE = 3 * 2048;
  
  const readable = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = new Uint8Array(0);
      let position = 0;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (value) {
            // Ajouter au buffer
            const newBuffer = new Uint8Array(buffer.length + value.length);
            newBuffer.set(buffer);
            newBuffer.set(value, buffer.length);
            buffer = newBuffer;
          }
          
          // Traiter les chunks complets
          while (buffer.length >= ENCRYPT_CHUNK_SIZE) {
            const chunk = buffer.slice(0, ENCRYPT_CHUNK_SIZE);
            buffer = buffer.slice(ENCRYPT_CHUNK_SIZE);
            
            // Déchiffrer les premiers 2048 bytes
            if (chunk.length >= 2048) {
              const encryptedPart = chunk.slice(0, 2048);
              const decryptedPart = decryptChunk(blowfishKey, encryptedPart);
              const remainingPart = chunk.slice(2048);
              
              const decryptedChunk = new Uint8Array(chunk.length);
              decryptedChunk.set(decryptedPart, 0);
              decryptedChunk.set(remainingPart, 2048);
              
              controller.enqueue(decryptedChunk);
            } else {
              controller.enqueue(chunk);
            }
            
            position += ENCRYPT_CHUNK_SIZE;
          }
          
          if (done) {
            // Traiter le dernier chunk
            if (buffer.length > 0) {
              if (buffer.length >= 2048) {
                const encryptedPart = buffer.slice(0, 2048);
                const decryptedPart = decryptChunk(blowfishKey, encryptedPart);
                const remainingPart = buffer.slice(2048);
                
                const decryptedChunk = new Uint8Array(buffer.length);
                decryptedChunk.set(decryptedPart, 0);
                decryptedChunk.set(remainingPart, 2048);
                
                controller.enqueue(decryptedChunk);
              } else {
                controller.enqueue(buffer);
              }
            }
            controller.close();
            break;
          }
        }
      } catch (error) {
        console.error('[Deezer] Streaming error:', error);
        controller.error(error);
      }
    },
  });
  
  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': downloadInfo.format === 'FLAC' ? 'audio/flac' : 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accepter les paramètres en query string (GET) ou en body (POST)
    const url = new URL(req.url);
    let trackId = url.searchParams.get('trackId');
    const trackUrlParam = url.searchParams.get('trackUrl');
    let quality = parseInt(url.searchParams.get('quality') || '2');

    // Si pas de query params, essayer le body (POST)
    if ((!trackId && !trackUrlParam) && req.method === 'POST') {
      const body = await req.json();
      trackId = body.trackId || body.id || null;
      quality = body.quality || 2;
    }

    // Si une URL complète est fournie, extraire l'ID
    const extractFromUrl = (input: string | null): string | null => {
      if (!input) return null;
      const m = input.match(/track\/(\d+)/) || input.match(/(?:deezer:)?(\d+)/);
      return m ? m[1] : null;
    };

    if (!trackId && trackUrlParam) {
      trackId = extractFromUrl(trackUrlParam);
    }
    if (trackId && /http(s)?:\/\//.test(trackId)) {
      trackId = extractFromUrl(trackId);
    }

    if (!trackId) {
      return new Response(
        JSON.stringify({ error: 'Track ID requis (query param trackId/trackUrl ou body)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const arl = Deno.env.get('DEEZER_ARL');
    if (!arl) {
      return new Response(
        JSON.stringify({ error: 'DEEZER_ARL non configuré' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Deezer Stream] Demande pour track ${trackId}, qualité ${quality}`);

    // Récupérer les infos de téléchargement
    const downloadInfo = await getTrackDownloadInfo(arl, trackId, quality);
    
    console.log(`[Deezer Stream] URL obtenue, encrypted: ${downloadInfo.isEncrypted}`);

    // Streamer le fichier (avec déchiffrement si nécessaire)
    return await streamTrack(downloadInfo);

  } catch (error) {
    console.error('[Deezer Stream] Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
