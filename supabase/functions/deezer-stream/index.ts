/**********************************************************************************************
 *         DEEZER STREAM — VERSION 2025 FIX — COMPATIBLE EDGE FUNCTIONS SUPABASE
 *      Inclut : api_token extraction fix, license token fix, Blowfish decrypt, gateway fix
 **********************************************************************************************/

import {
  createHash,
  createCipheriv
} from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLOWFISH_SECRET = "g4el58wc0zvf9na1";

/* ============================================================================================
   BLOWFISH KEY (identique Python)
================================================================================================*/
function generateBlowfishKey(trackId: string): Uint8Array {
  const md5 = createHash("md5").update(trackId).digest("hex");
  const key = [];

  for (let i = 0; i < 16; i++) {
    const a = md5.charCodeAt(i);
    const b = md5.charCodeAt(i + 16);
    const c = BLOWFISH_SECRET.charCodeAt(i);
    key.push(a ^ b ^ c);
  }
  return new Uint8Array(key);
}

/* ============================================================================================
   BLOWFISH DECRYPTION (identique Python)
================================================================================================*/
function decryptChunk(key: Uint8Array, data: Uint8Array): Uint8Array {
  const iv = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
  const cipher = createCipheriv("bf-cbc", key, iv);
  cipher.setAutoPadding(false);

  const out = cipher.update(data);
  return new Uint8Array(out);
}

/* ============================================================================================
   URL ENCRYPTED FALLBACK (identique Python)
================================================================================================*/
function getEncryptedFileUrl(metaId: string, trackHash: string, mediaVersion: string): string {
  const formatNumber = 1;

  const urlBytes = [
    trackHash, String(formatNumber), String(metaId), String(mediaVersion)
  ].join("\xa4");

  const urlHash = createHash("md5").update(urlBytes).digest("hex");

  let info = urlHash + "\xa4" + urlBytes + "\xa4";
  const padding = 16 - (info.length % 16);
  info += ".".repeat(padding);

  const cipher = createCipheriv("aes-128-ecb", "jo6aey6haid2Teih", null);
  cipher.setAutoPadding(false);

  const encrypted = cipher.update(info);
  const path = Buffer.from(encrypted).toString("hex");

  return `https://e-cdns-proxy-${trackHash[0]}.dzcdn.net/mobile/1/${path}`;
}

/* ============================================================================================
   DEEZER GATEWAY CALL (identique Python, mais consolidé)
================================================================================================*/
async function deezerGwApiCall(arl: string, method: string, params: any = {}, apiToken: string = "null"): Promise<any> {
  const res = await fetch("https://www.deezer.com/ajax/gw-light.php", {
    method: "POST",
    headers: {
      Cookie: `arl=${arl}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_version: "1.0",
      api_token: apiToken,
      input: "3",
      method,
      params,
    }),
  });

  const json = await res.json();
  return json?.results || null;
}

/* ============================================================================================
   API TOKEN FIX 2025 (LA PARTIE QUI CORRIGE TON BUG)
================================================================================================*/
let cachedUserData: { apiToken: string; licenseToken: string; fetchedAt: number } | null = null;

async function getUserData(arl: string): Promise<{ apiToken: string; licenseToken: string }> {
  if (
    cachedUserData &&
    Date.now() - cachedUserData.fetchedAt < 10 * 60 * 1000
  ) {
    return cachedUserData;
  }

  console.log("[Deezer FIX] Fetching user data…");

  const res = await fetch("https://www.deezer.com/ajax/gw-light.php", {
    method: "POST",
    headers: {
      Cookie: `arl=${arl}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_version: "1.0",
      api_token: "null",
      input: "3",
      method: "deezer.getUserData",
      params: {},
    }),
  });

  const json = await res.json();
  const r = json?.results || {};

  let apiToken =
    r.checkForm ||
    r.CHECKFORM ||
    r.check_form ||
    r.user?.CHECKFORM ||
    r.USER?.CHECKFORM ||
    r.USER?.OPTIONS?.checkForm ||
    r.CONFIGS?.checkForm ||
    null;

  let licenseToken =
    r.USER?.LICENSE_TOKEN ||
    r.license_token ||
    "";

  // LAST RESORT: Check HTML
  if (!apiToken) {
    console.log("[Deezer FIX] Extracting api_token from HTML…");

    const home = await fetch("https://www.deezer.com/", {
      headers: { Cookie: `arl=${arl}` },
    });

    const html = await home.text();
    apiToken =
      html.match(/"checkForm":"([a-zA-Z0-9-_]+)"/)?.[1] ||
      html.match(/"api_token":"([a-zA-Z0-9-_]+)"/)?.[1] ||
      null;
  }

  if (!apiToken) throw new Error("Impossible d'obtenir api_token");

  cachedUserData = {
    apiToken,
    licenseToken,
    fetchedAt: Date.now(),
  };

  return cachedUserData;
}

/* ============================================================================================
   GET URL VIA TOKEN (media.deezer.com)
================================================================================================*/
async function getTrackToken(arl: string, trackToken: string, licenseToken: string): Promise<string | null> {
  const res = await fetch("https://media.deezer.com/v1/get_url", {
    method: "POST",
    headers: {
      Cookie: `arl=${arl}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      track_tokens: [trackToken],
      license_token: licenseToken,
      media: [
        {
          type: "FULL",
          formats: [
            { cipher: "BF_CBC_STRIPE", format: "FLAC" },
            { cipher: "BF_CBC_STRIPE", format: "MP3_320" },
            { cipher: "BF_CBC_STRIPE", format: "MP3_128" },
          ],
        },
      ],
    }),
  });

  const data = await res.json();
  return data?.data?.[0]?.media?.[0]?.sources?.[0]?.url || null;
}

/* ============================================================================================
   GET TRACK DOWNLOAD INFO (corrigé)
================================================================================================*/
async function getTrackDownloadInfo(arl: string, trackId: string, quality: number = 2): Promise<any> {
  console.log(`[Deezer] Fetch track ${trackId}`);

  const { apiToken, licenseToken } = await getUserData(arl);

  let trackInfo = await deezerGwApiCall(
    arl,
    "song.getData",
    { sng_id: trackId },
    apiToken
  );

  if (!trackInfo || !trackInfo.SNG_ID) {
    // Fallback to list API
    const list = await deezerGwApiCall(
      arl,
      "song.getListData",
      { sng_ids: [trackId] },
      apiToken
    );
    const candidate = Array.isArray(list) ? list[0] : (list?.data?.[0] || null);
    if (candidate?.SNG_ID) {
      trackInfo = candidate;
    } else {
      console.error("[Deezer ERROR] Invalid trackInfo (after fallback):", list);
      throw new Error(`No track data found for track ${trackId}`);
    }
  }

  const track = trackInfo;

  const qualityMap = [
    { format: "MP3_128", key: "FILESIZE_MP3_128" },
    { format: "MP3_320", key: "FILESIZE_MP3_320" },
    { format: "FLAC", key: "FILESIZE_FLAC" },
  ];

  while (
    quality > 0 &&
    parseInt(track[qualityMap[quality].key] || "0") === 0
  ) {
    console.log(`[Deezer] Fallback ${quality} → ${quality - 1}`);
    quality--;
  }

  const selectedQuality = qualityMap[quality];
  const token = track.TRACK_TOKEN;

  let url = null;

  if (licenseToken && token) {
    url = await getTrackToken(arl, token, licenseToken);
  }

  if (!url)
    url = getEncryptedFileUrl(trackId, track.MD5_ORIGIN, track.MEDIA_VERSION);

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

/* ============================================================================================
   STREAM AUDIO (décrypté si besoin)
================================================================================================*/
async function streamTrack(info: any): Promise<Response> {
  console.log(`[Deezer] Streaming URL: ${info.url}`);

  const res = await fetch(info.url, {
    headers: { "User-Agent": "Mozilla" },
  });

  if (!res.ok) throw new Error("Fetch audio failed");

  if (!info.isEncrypted) {
    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": info.format === "FLAC" ? "audio/flac" : "audio/mpeg",
      },
    });
  }

  console.log("[Deezer] Encrypted → decrypting…");

  const key = generateBlowfishKey(info.id);
  const ENCRYPT_CHUNK_SIZE = 6144; // 3 * 2048

  const reader = res.body!.getReader();

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) return controller.close();

      let buf = value;
      while (buf.length >= ENCRYPT_CHUNK_SIZE) {
        const chunk = buf.slice(0, ENCRYPT_CHUNK_SIZE);
        buf = buf.slice(ENCRYPT_CHUNK_SIZE);

        const enc = chunk.slice(0, 2048);
        const dec = decryptChunk(key, enc);

        const out = new Uint8Array(chunk.length);
        out.set(dec, 0);
        out.set(chunk.slice(2048), 2048);
        controller.enqueue(out);
      }

      if (buf.length > 0) {
        controller.enqueue(buf);
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": info.format === "FLAC" ? "audio/flac" : "audio/mpeg",
    },
  });
}

/* ============================================================================================
   MAIN ENTRYPOINT
================================================================================================*/
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let trackId = url.searchParams.get("trackId");
    const trackUrl = url.searchParams.get("trackUrl");
    let quality = parseInt(url.searchParams.get("quality") || "2");

    // Normalize ID from any input (full URL, deezer:ID, plain ID)
    const extractFromInput = (input: string | null): string | null => {
      if (!input) return null;
      const m = input.match(/track\/(\d+)/) || input.match(/(?:deezer:)?(\d+)/);
      return m ? m[1] : null;
    };

    if (!trackId && trackUrl) {
      trackId = extractFromInput(trackUrl);
    }
    trackId = extractFromInput(trackId);

    if (!trackId)
      return new Response(JSON.stringify({ error: "trackId missing" }), {
        status: 400,
        headers: corsHeaders,
      });

    const arl = Deno.env.get("DEEZER_ARL");
    if (!arl)
      return new Response(JSON.stringify({ error: "No ARL" }), {
        status: 500,
        headers: corsHeaders,
      });

    const info = await getTrackDownloadInfo(arl, trackId, quality);
    return await streamTrack(info);
  } catch (err) {
    console.error("[Deezer ERROR]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
