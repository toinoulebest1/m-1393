/**
 * Service de proxy audio pour Deezer avec Deezmate et Flacdownloader
 */
import { supabase } from '@/integrations/supabase/client';

const PROXY_TIMEOUT = 1500; // 1.5 secondes

class AudioProxyService {
  /**
   * Obtenir l'URL audio en interrogeant les services en parallèle avec timeouts.
   */
  async getAudioUrl(trackId: string, quality: string = 'FLAC'): Promise<{ url: string; duration?: number } | null> {
    console.log(`🚀 Récupération URL pour ${trackId} via services parallèles...`);

    try {
      const result = await Promise.any([
        this.tryDeezmateProxy(trackId),
        this.tryFlacdownloaderProxy(trackId),
      ]);

      if (result) {
        console.log(`✅ URL trouvée pour ${trackId}:`, result.url.substring(0, 70) + "...");
        return result;
      }
    } catch (error) {
      console.error(`❌ Toutes les sources ont échoué pour ${trackId}:`, error);
    }

    return null;
  }

  /**
   * Helper pour créer une promesse avec timeout.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, serviceName: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout de ${ms}ms dépassé pour le service ${serviceName}`));
      }, ms);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  /**
   * Essayer le proxy Deezmate.
   */
  private async tryDeezmateProxy(trackId: string): Promise<{ url: string; duration?: number }> {
    console.log("🎵 Tentative Deezmate Proxy...");
    const promise = supabase.functions.invoke('deezmate-proxy', {
      body: { trackId },
    });

    const { data, error } = await this.withTimeout(promise, PROXY_TIMEOUT, 'Deezmate');

    if (error) throw new Error(`Deezmate Proxy a échoué: ${error.message}`);
    if (!data.success || !data.links?.flac) throw new Error('Réponse Deezmate invalide');
    
    return { url: data.links.flac };
  }

  /**
   * Essayer le proxy Flacdownloader.
   */
  private async tryFlacdownloaderProxy(trackId: string): Promise<{ url: string; duration?: number }> {
    console.log("🎵 Tentative Flacdownloader Proxy...");
    const promise = supabase.functions.invoke('flacdownloader-proxy', {
      body: { deezerId: trackId },
    });
    
    const { data, error } = await this.withTimeout(promise, PROXY_TIMEOUT, 'Flacdownloader');

    if (error) throw new Error(`Flacdownloader Proxy a échoué: ${error.message}`);
    // Le proxy flacdownloader retourne directement une URL, pas un JSON
    if (typeof data?.url !== 'string') throw new Error('Réponse Flacdownloader invalide');

    return { url: data.url, duration: data.duration };
  }

  /**
   * Précharger l'audio d'une piste (résolution d'URL uniquement).
   */
  async preloadTrack(trackId: string, quality: string = 'FLAC'): Promise<void> {
    console.log("🔮 Préchargement (URL seulement):", trackId);
    try {
      // Ne pas attendre le résultat, juste lancer la requête
      this.getAudioUrl(trackId, quality);
    } catch (error) {
      // L'échec du préchargement est silencieux
    }
  }
}

// Instance singleton
export const audioProxyService = new AudioProxyService();