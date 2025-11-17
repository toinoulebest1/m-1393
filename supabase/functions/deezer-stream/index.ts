import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { Aes } from "https://deno.land/x/crypto@v0.10.0/aes.ts";
import { Ecb } from "https://deno.land/x/crypto@v0.10.0/block-modes.ts";
import { Blowfish } from "https://cdn.skypack.dev/egoroof-blowfish@4.0.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLOWFISH_SECRET = "g4el58wc0zvf9na1";

// Deezer API endpoints
const DEEZER_API = "https://api.deezer.com";
const DEEZER_GW_API = "https://www.deezer.com/ajax/gw-light.php";

interface DeezerTrackInfo {
  url: string;
  quality: number;
  title: string;
  artist: string;
  album: string;
  format: string;
  id: string;
  isEncrypted: boolean;
}

class DeezerClient {
  private arl: string;
  private sessionId: string | null = null;

  constructor(arl: string) {
    this.arl = arl;
  }

  async login() {
    const response = await fetch(DEEZER_GW_API + "?method=deezer.getUserData&api_version=1.0&api_token=", {
      method: "POST",
      headers: {
        "Cookie": `arl=${this.arl}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();
    if (!data.results || data.results.USER?.USER_ID === 0) {
      throw new Error("Invalid ARL - Authentication failed");
    }

    this.sessionId = data.results.checkForm;
    return true;
  }

  async getTrackInfo(trackId: string): Promise<any> {
    const response = await fetch(`${DEEZER_API}/track/${trackId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch track info: ${response.statusText}`);
    }
    return await response.json();
  }

  async getTrackGWInfo(trackId: string): Promise<any> {
    const response = await fetch(DEEZER_GW_API + "?method=song.getData&api_version=1.0&api_token=", {
      method: "POST",
      headers: {
        "Cookie": `arl=${this.arl}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sng_id: trackId }),
    });

    const data = await response.json();
    if (!data.results) {
      throw new Error("Failed to fetch track GW info");
    }
    return data.results;
  }

  async getTrackUrl(token: string, format: string): Promise<string | null> {
    const response = await fetch(DEEZER_GW_API + "?method=song.getListData&api_version=1.0&api_token=", {
      method: "POST",
      headers: {
        "Cookie": `arl=${this.arl}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sng_ids: [token] }),
    });

    const data = await response.json();
    if (data.results?.data?.[0]?.MEDIA?.[0]?.SOURCES) {
      return data.results.data[0].MEDIA[0].SOURCES[0].URL || null;
    }
    return null;
  }

  getEncryptedFileUrl(trackId: string, trackHash: string, mediaVersion: string): string {
    const formatNumber = 1;
    const urlBytes = new TextEncoder().encode(
      `${trackHash}\xa4${formatNumber}\xa4${trackId}\xa4${mediaVersion}`
    );

    // MD5 hash
    const urlHash = this.md5(urlBytes);
    const infoBytes = new Uint8Array(urlHash.length + 1 + urlBytes.length + 1);
    
    let offset = 0;
    infoBytes.set(urlHash, offset);
    offset += urlHash.length;
    infoBytes[offset++] = 0xa4;
    infoBytes.set(urlBytes, offset);
    offset += urlBytes.length;
    infoBytes[offset++] = 0xa4;

    // Pad to 16 bytes
    const paddingLen = 16 - (infoBytes.length % 16);
    const paddedBytes = new Uint8Array(infoBytes.length + paddingLen);
    paddedBytes.set(infoBytes);
    for (let i = infoBytes.length; i < paddedBytes.length; i++) {
      paddedBytes[i] = 0x2e; // '.'
    }

    // AES encryption
    const encrypted = this.aesEncrypt(paddedBytes);
    const path = this.bytesToHex(encrypted);
    
    return `https://e-cdns-proxy-${trackHash[0]}.dzcdn.net/mobile/1/${path}`;
  }

  private md5(data: Uint8Array): Uint8Array {
    const hash = crypto.subtle.digestSync("MD5", data);
    return new Uint8Array(hash);
  }

  private aesEncrypt(data: Uint8Array): Uint8Array {
    const key = new TextEncoder().encode("jo6aey6haid2Teih");
    const cipher = new Ecb(Aes, key);
    return cipher.encrypt(data);
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async getTrackDownloadInfo(trackId: string, quality: number = 2): Promise<DeezerTrackInfo> {
    const gwInfo = await this.getTrackGWInfo(trackId);
    
    const qualityMap = [
      { id: 9, format: "MP3_128" },
      { id: 3, format: "MP3_320" },
      { id: 1, format: "FLAC" },
    ];

    const sizeMap = [
      parseInt(gwInfo.FILESIZE_MP3_128 || "0"),
      parseInt(gwInfo.FILESIZE_MP3_320 || "0"),
      parseInt(gwInfo.FILESIZE_FLAC || "0"),
    ];

    // Find available quality
    while (sizeMap[quality] === 0 && quality > 0) {
      console.log(`Quality ${quality} not available, falling back...`);
      quality--;
    }

    const { format } = qualityMap[quality];
    const token = gwInfo.TRACK_TOKEN;

    let url = await this.getTrackUrl(token, format);
    
    if (!url) {
      url = this.getEncryptedFileUrl(
        trackId,
        gwInfo.MD5_ORIGIN,
        gwInfo.MEDIA_VERSION
      );
    }

    const isEncrypted = /\/m(obile|edia)\//.test(url);

    return {
      url,
      quality,
      title: gwInfo.SNG_TITLE,
      artist: gwInfo.ART_NAME,
      album: gwInfo.ALB_TITLE,
      format,
      id: trackId,
      isEncrypted,
    };
  }

  generateBlowfishKey(trackId: string): Uint8Array {
    const md5Hash = this.bytesToHex(this.md5(new TextEncoder().encode(trackId)));
    const part1 = md5Hash.slice(0, 16);
    const part2 = md5Hash.slice(16);
    
    let key = "";
    for (let i = 0; i < 16; i++) {
      key += String.fromCharCode(
        part1.charCodeAt(i) ^ part2.charCodeAt(i) ^ BLOWFISH_SECRET.charCodeAt(i)
      );
    }
    
    return new TextEncoder().encode(key);
  }

  async decryptChunk(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const iv = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const bf = new Blowfish(Array.from(key), Blowfish.MODE.CBC, Blowfish.PADDING.NULL);
    bf.setIv(Array.from(iv));
    
    // Convertir Uint8Array en Array pour la librairie
    const dataArray = Array.from(data);
    const decrypted = bf.decode(dataArray, Blowfish.TYPE.UINT8_ARRAY);
    
    return new Uint8Array(decrypted);
  }

  async downloadAndDecrypt(trackInfo: DeezerTrackInfo): Promise<Uint8Array> {
    const response = await fetch(trackInfo.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:83.0) Gecko/20100101 Firefox/83.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download track: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    let data = new Uint8Array(arrayBuffer);

    if (trackInfo.isEncrypted) {
      console.log(`Decrypting track ${trackInfo.id}...`);
      const key = this.generateBlowfishKey(trackInfo.id);
      const decrypted = new Uint8Array(data.length);
      
      const chunkSize = 3 * 2048;
      let offset = 0;

      while (offset < data.length) {
        const end = Math.min(offset + chunkSize, data.length);
        const chunk = data.slice(offset, end);

        if (chunk.length >= 2048) {
          const encryptedPart = chunk.slice(0, 2048);
          const decryptedPart = await this.decryptChunk(key, encryptedPart);
          decrypted.set(decryptedPart, offset);
          decrypted.set(chunk.slice(2048), offset + 2048);
        } else {
          decrypted.set(chunk, offset);
        }

        offset = end;
      }

      return decrypted;
    }

    return data;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get DEEZER_ARL from secrets
    const { data: secretData, error: secretError } = await supabaseClient
      .from('secrets')
      .select('value')
      .eq('name', 'DEEZER_ARL')
      .single();

    if (secretError || !secretData) {
      return new Response(
        JSON.stringify({ error: 'DEEZER_ARL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { trackId, quality = 2, action = 'info' } = await req.json();

    if (!trackId) {
      return new Response(
        JSON.stringify({ error: 'trackId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const client = new DeezerClient(secretData.value);
    await client.login();

    const trackInfo = await client.getTrackDownloadInfo(trackId, quality);

    if (action === 'info') {
      return new Response(
        JSON.stringify({ success: true, trackInfo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'stream') {
      const audioData = await client.downloadAndDecrypt(trackInfo);
      const mimeType = trackInfo.format === 'FLAC' ? 'audio/flac' : 'audio/mpeg';

      return new Response(audioData, {
        headers: {
          ...corsHeaders,
          'Content-Type': mimeType,
          'Content-Length': audioData.length.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Deezer stream error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
