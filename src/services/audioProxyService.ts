/**
 * Service de proxy audio pour Deezer avec Deezmate et Flacdownloader
 */
import { durationToSeconds } from '@/utils/mediaSession';

interface CachedAudio {
  blob: Blob;
  timestamp: number;
  duration?: number;
  objectUrl?: string; // Garder une référence à l'URL
}

class AudioProxyService {
  private audioCache = new Map<string, CachedAudio>();
  private readonly AUDIO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes pour le blob audio
  private readonly MAX_CACHE_SIZE = 50;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log("🔌 Initialisation du service audio Deezer...");
    this.initialized = true;
  }

  /**
   * Obtenir l'URL audio via les nouvelles instances Deezer
   */
  async getAudioUrl(trackId: string, quality: string = 'FLAC'): Promise<{ url: string; duration?: number } | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Vérifier le cache de blobs audio
    const cacheKey = `${trackId}_${quality}`;
    const cached = this.audioCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.AUDIO_CACHE_TTL) {
      console.log("🎯 Cache audio hit:", trackId);
      
      // Recréer l'URL si nécessaire
      if (!cached.objectUrl) {
        cached.objectUrl = URL.createObjectURL(cached.blob);
        console.log("🔗 URL blob recréée:", cached.objectUrl.substring(0, 50) + "...");
      }
      
      return { url: cached.objectUrl, duration: cached.duration };
    }

    console.log(`🚀 Récupération audio pour ${trackId}...`);

    // Essayer Deezmate en premier
    try {
      const deezmateResult = await this.tryDeezmate(trackId);
      if (deezmateResult) {
        const objectUrl = URL.createObjectURL(deezmateResult.blob);
        this.cacheAudio(cacheKey, deezmateResult.blob, deezmateResult.duration, objectUrl);
        console.log("✅ FLAC Deezmate prêt:", objectUrl.substring(0, 50) + "...");
        return { url: objectUrl, duration: deezmateResult.duration };
      }
    } catch (error) {
      console.warn("⚠️ Deezmate échoué:", error);
    }

    // Fallback vers Flacdownloader
    try {
      const flacdownloaderResult = await this.tryFlacdownloader(trackId);
      if (flacdownloaderResult) {
        const objectUrl = URL.createObjectURL(flacdownloaderResult.blob);
        this.cacheAudio(cacheKey, flacdownloaderResult.blob, flacdownloaderResult.duration, objectUrl);
        console.log("✅ FLAC Flacdownloader prêt:", objectUrl.substring(0, 50) + "...");
        return { url: objectUrl, duration: flacdownloaderResult.duration };
      }
    } catch (error) {
      console.warn("⚠️ Flacdownloader échoué:", error);
    }

    console.error("❌ Toutes les sources ont échoué pour:", trackId);
    return null;
  }

  /**
   * Essayer Deezmate
   */
  private async tryDeezmate(trackId: string): Promise<{ blob: Blob; duration?: number } | null> {
    console.log("🎵 Tentative Deezmate...");
    
    const response = await fetch(`https://api.deezmate.com/dl/${trackId}`);
    
    if (!response.ok) {
      throw new Error(`Deezmate HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("📋 Réponse Deezmate:", data);
    
    if (data.success && data.links && data.links.flac) {
      console.log("✅ Deezmate succès, téléchargement du FLAC...");
      console.log("🔗 URL FLAC:", data.links.flac);
      
      try {
        // Télécharger le fichier FLAC avec timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn("⏰ Timeout téléchargement FLAC (30s)");
          controller.abort();
        }, 30000); // 30 secondes max
        
        console.log("⬇️ Début téléchargement FLAC...");
        const downloadStart = performance.now();
        
        const audioResponse = await fetch(data.links.flac, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!audioResponse.ok) {
          throw new Error(`Téléchargement Deezmate HTTP ${audioResponse.status}`);
        }
        
        console.log("📊 En-têtes réponse:", Object.fromEntries(audioResponse.headers.entries()));
        console.log("📊 Content-Length:", audioResponse.headers.get('content-length'));
        console.log("📊 Content-Type:", audioResponse.headers.get('content-type'));
        
        // Stream le téléchargement avec logs de progression
        const contentLength = audioResponse.headers.get('content-length');
        const reader = audioResponse.body?.getReader();
        
        if (!reader) {
          throw new Error('Impossible de lire le flux de téléchargement');
        }
        
        let receivedLength = 0;
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          receivedLength += value.length;
          
          // Log de progression toutes les 5MB
          if (receivedLength % (5 * 1024 * 1024) < 1024 * 1024) {
            const progress = contentLength ? ((receivedLength / parseInt(contentLength)) * 100).toFixed(1) : 'N/A';
            console.log(`📥 Téléchargement FLAC: ${(receivedLength / 1024 / 1024).toFixed(1)}MB (${progress}%)`);
          }
        }
        
        // Assembler le blob
        const blob = new Blob(chunks);
        const downloadTime = performance.now() - downloadStart;
        
        console.log("✅ FLAC téléchargé:", blob.size, "bytes");
        console.log("⏱️ Temps de téléchargement:", downloadTime.toFixed(0), "ms");
        console.log("📝 Type MIME:", blob.type);
        console.log("📝 Détails blob:", {
          size: blob.size,
          type: blob.type,
          isAudio: blob.type.startsWith('audio/'),
          lastModified: blob.lastModified
        });
        
        // Vérifier si le blob est valide
        if (blob.size === 0) {
          throw new Error('Blob vide - téléchargement échoué');
        }
        
        // Vérifier si le blob semble être un fichier audio valide
        if (!blob.type.startsWith('audio/') && blob.type !== '') {
          console.warn("⚠️ Type MIME inattendu:", blob.type);
        }
        
        return { blob };
        
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error('Téléchargement FLAC trop lent (timeout 30s)');
        }
        throw error;
      }
    }

    throw new Error('Réponse Deezmate invalide');
  }

  /**
   * Essayer Flacdownloader
   */
  private async tryFlacdownloader(trackId: string): Promise<{ blob: Blob; duration?: number } | null> {
    console.log("🎵 Tentative Flacdownloader...");
    
    // D'abord, obtenir le lien de partage Deezer
    const shareLink = await this.getDeezerShareLink(trackId);
    if (!shareLink) {
      throw new Error('Impossible d\'obtenir le lien de partage Deezer');
    }

    const flacdownloaderUrl = `https://flacdownloader.com/flac/download?t=${shareLink}&f=FLAC`;
    console.log("🔗 URL Flacdownloader:", flacdownloaderUrl);
    
    const response = await fetch(flacdownloaderUrl);
    
    if (!response.ok) {
      throw new Error(`Flacdownloader HTTP ${response.status}`);
    }

    // Flacdownloader retourne généralement un JSON avec l'URL
    const data = await response.json();
    console.log("📋 Réponse Flacdownloader:", data);
    
    if (data.url && data.url.startsWith('http')) {
      console.log("✅ Flacdownloader succès, téléchargement...");
      
      // Télécharger le fichier immédiatement
      const audioResponse = await fetch(data.url);
      if (!audioResponse.ok) {
        throw new Error(`Téléchargement Flacdownloader HTTP ${audioResponse.status}`);
      }
      
      const blob = await audioResponse.blob();
      console.log("✅ FLAC téléchargé:", blob.size, "bytes");
      console.log("📝 Type MIME:", blob.type);
      
      return { blob, duration: data.duration };
    }

    throw new Error('URL Flacdownloader invalide');
  }

  /**
   * Obtenir le lien de partage Deezer
   */
  private async getDeezerShareLink(trackId: string): Promise<string | null> {
    try {
      // Utiliser l'API Deezer pour obtenir le lien de partage
      const response = await fetch(`https://api.deezer.com/track/${trackId}`);
      
      if (!response.ok) {
        throw new Error(`Deezer API HTTP ${response.status}`);
      }

      const trackData = await response.json();
      
      if (trackData.link) {
        return trackData.link;
      }

      // Fallback: construire le lien manuellement
      return `https://link.deezer.com/s/${trackId}`;
    } catch (error) {
      console.warn("⚠️ Erreur obtention lien partage Deezer:", error);
      return `https://link.deezer.com/s/${trackId}`;
    }
  }

  /**
   * Mettre en cache un blob audio
   */
  private cacheAudio(key: string, blob: Blob, duration?: number, objectUrl?: string): void {
    // Limiter la taille du cache
    if (this.audioCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.audioCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      
      // Libérer l'URL de l'ancien blob
      const oldEntry = this.audioCache.get(oldestKey);
      if (oldEntry?.objectUrl) {
        URL.revokeObjectURL(oldEntry.objectUrl);
      }
      
      this.audioCache.delete(oldestKey);
    }

    this.audioCache.set(key, {
      blob,
      timestamp: Date.now(),
      duration,
      objectUrl
    });
    
    console.log("💾 Audio mis en cache:", key, `(${this.audioCache.size}/${this.MAX_CACHE_SIZE})`, `${blob.size} bytes`);
  }

  /**
   * Précharger l'audio d'une piste
   */
  async preloadTrack(trackId: string, quality: string = 'FLAC'): Promise<void> {
    console.log("🔮 Préchargement:", trackId);
    try {
      await this.getAudioUrl(trackId, quality);
    } catch (error) {
      console.warn("⚠️ Échec préchargement:", trackId, error);
    }
  }

  /**
   * Nettoyer le cache périodiquement
   */
  cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, cached] of this.audioCache.entries()) {
      if (now - cached.timestamp > this.AUDIO_CACHE_TTL) {
        // Libérer l'URL du blob
        if (cached.objectUrl) {
          URL.revokeObjectURL(cached.objectUrl);
        }
        this.audioCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log("🧹 Cache audio nettoyé:", cleaned, "entrées expirées");
    }
  }

  /**
   * Obtenir les statistiques du service
   */
  getStats() {
    return {
      cacheSize: this.audioCache.size,
      sources: ['Deezmate', 'Flacdownloader']
    };
  }
}

// Instance singleton
export const audioProxyService = new AudioProxyService();

// Nettoyage périodique du cache (toutes les 5 minutes)
setInterval(() => {
  audioProxyService.cleanupCache();
}, 5 * 60 * 1000);