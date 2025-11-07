/**
 * Service de proxy audio simplifié pour Deezer avec Deezmate et Flacdownloader
 */
import { durationToSeconds } from '@/utils/mediaSession';

interface CachedUrl {
  url: string;
  timestamp: number;
  duration?: number;
}

class AudioProxyService {
  private urlCache = new Map<string, CachedUrl>();
  private readonly URL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log("🔌 Initialisation du service audio Deezer...");
    this.initialized = true;
  }

  /**
   * Obtenir l'URL audio via les nouvelles instances Deezer
   */
  async getAudioUrl(trackId: string, quality: string = 'MP3_320'): Promise<{ url: string; duration?: number } | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Vérifier le cache
    const cacheKey = `${trackId}_${quality}`;
    const cached = this.urlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.URL_CACHE_TTL) {
      console.log("🎯 Cache hit:", trackId);
      return { url: cached.url, duration: cached.duration };
    }

    console.log(`🚀 Récupération audio pour ${trackId}...`);

    // Essayer Deezmate en premier
    try {
      const deezmateResult = await this.tryDeezmate(trackId);
      if (deezmateResult) {
        this.cacheUrl(cacheKey, deezmateResult.url, deezmateResult.duration);
        return deezmateResult;
      }
    } catch (error) {
      console.warn("⚠️ Deezmate échoué:", error);
    }

    // Fallback vers Flacdownloader
    try {
      const flacdownloaderResult = await this.tryFlacdownloader(trackId);
      if (flacdownloaderResult) {
        this.cacheUrl(cacheKey, flacdownloaderResult.url, flacdownloaderResult.duration);
        return flacdownloaderResult;
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
  private async tryDeezmate(trackId: string): Promise<{ url: string; duration?: number } | null> {
    console.log("🎵 Tentative Deezmate...");
    
    const response = await fetch(`https://api.deezmate.com/dl/${trackId}`);
    
    if (!response.ok) {
      throw new Error(`Deezmate HTTP ${response.status}`);
    }

    const audioUrl = await response.text();
    
    if (audioUrl && audioUrl.startsWith('http')) {
      console.log("✅ Deezmate succès:", audioUrl.substring(0, 50) + "...");
      return { url: audioUrl };
    }

    throw new Error('URL Deezmate invalide');
  }

  /**
   * Essayer Flacdownloader
   */
  private async tryFlacdownloader(trackId: string): Promise<{ url: string; duration?: number } | null> {
    console.log("🎵 Tentative Flacdownloader...");
    
    // D'abord, obtenir le lien de partage Deezer
    const shareLink = await this.getDeezerShareLink(trackId);
    if (!shareLink) {
      throw new Error('Impossible d\'obtenir le lien de partage Deezer');
    }

    const flacdownloaderUrl = `https://flacdownloader.com/flac/download?t=${shareLink}&f=FLAC`;
    
    const response = await fetch(flacdownloaderUrl);
    
    if (!response.ok) {
      throw new Error(`Flacdownloader HTTP ${response.status}`);
    }

    // Flacdownloader retourne généralement un JSON avec l'URL
    const data = await response.json();
    
    if (data.url && data.url.startsWith('http')) {
      console.log("✅ Flacdownloader succès:", data.url.substring(0, 50) + "...");
      return { url: data.url, duration: data.duration };
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
   * Mettre en cache une URL
   */
  private cacheUrl(key: string, url: string, duration?: number): void {
    // Limiter la taille du cache
    if (this.urlCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.urlCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.urlCache.delete(oldestKey);
    }

    this.urlCache.set(key, {
      url,
      timestamp: Date.now(),
      duration
    });
    
    console.log("💾 URL mise en cache:", key, `(${this.urlCache.size}/${this.MAX_CACHE_SIZE})`);
  }

  /**
   * Précharger l'URL d'une piste
   */
  async preloadTrack(trackId: string, quality: string = 'MP3_320'): Promise<void> {
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
    
    for (const [key, cached] of this.urlCache.entries()) {
      if (now - cached.timestamp > this.URL_CACHE_TTL) {
        this.urlCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log("🧹 Cache nettoyé:", cleaned, "entrées expirées");
    }
  }

  /**
   * Obtenir les statistiques du service
   */
  getStats() {
    return {
      cacheSize: this.urlCache.size,
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