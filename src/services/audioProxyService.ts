/**
 * Service de proxy audio pour Deezer avec Deezmate et Flacdownloader
 */
import { durationToSeconds } from '@/utils/mediaSession';

class AudioProxyService {
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

    console.log(`🚀 Récupération URL pour ${trackId}...`);

    // Essayer Deezmate en premier
    try {
      const deezmateResult = await this.tryDeezmate(trackId);
      if (deezmateResult) {
        console.log("✅ URL Deezmate trouvée:", deezmateResult.url.substring(0, 70) + "...");
        return deezmateResult;
      }
    } catch (error) {
      console.warn("⚠️ Deezmate échoué:", error);
    }

    // Fallback vers Flacdownloader
    try {
      const flacdownloaderResult = await this.tryFlacdownloader(trackId);
      if (flacdownloaderResult) {
        console.log("✅ URL Flacdownloader trouvée:", flacdownloaderResult.url.substring(0, 70) + "...");
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

    const data = await response.json();
    console.log("📋 Réponse Deezmate:", data);
    
    if (data.success && data.links && data.links.flac) {
      console.log("✅ Deezmate succès, URL FLAC:", data.links.flac);
      return { url: data.links.flac };
    }

    throw new Error('Réponse Deezmate invalide');
  }

  /**
   * Essayer Flacdownloader
   */
  private async tryFlacdownloader(trackId: string): Promise<{ url: string; duration?: number } | null> {
    console.log("🎵 Tentative Flacdownloader...");
    
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

    const data = await response.json();
    console.log("📋 Réponse Flacdownloader:", data);
    
    if (data.url && data.url.startsWith('http')) {
      console.log("✅ Flacdownloader succès, URL:", data.url);
      return { url: data.url, duration: data.duration };
    }

    throw new Error('URL Flacdownloader invalide');
  }

  /**
   * Obtenir le lien de partage Deezer
   */
  private async getDeezerShareLink(trackId: string): Promise<string | null> {
    try {
      const response = await fetch(`https://api.deezer.com/track/${trackId}`);
      
      if (!response.ok) {
        throw new Error(`Deezer API HTTP ${response.status}`);
      }

      const trackData = await response.json();
      
      if (trackData.link) {
        return trackData.link;
      }

      return `https://link.deezer.com/s/${trackId}`;
    } catch (error) {
      console.warn("⚠️ Erreur obtention lien partage Deezer:", error);
      return `https://link.deezer.com/s/${trackId}`;
    }
  }

  /**
   * Précharger l'audio d'une piste
   */
  async preloadTrack(trackId: string, quality: string = 'FLAC'): Promise<void> {
    console.log("🔮 Préchargement (URL seulement):", trackId);
    try {
      await this.getAudioUrl(trackId, quality);
    } catch (error) {
      console.warn("⚠️ Échec préchargement (URL):", trackId, error);
    }
  }

  /**
   * Obtenir les statistiques du service
   */
  getStats() {
    return {
      cacheSize: 0, // Cache interne désactivé
      sources: ['Deezmate', 'Flacdownloader']
    };
  }
}

// Instance singleton
export const audioProxyService = new AudioProxyService();