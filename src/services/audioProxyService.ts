/**
 * Service de proxy audio pour Deezer via l'instance frankfurt.monochrome.tf
 */
import { supabase } from '@/integrations/supabase/client';

const PROXY_TIMEOUT = 5000; // 5 secondes

class AudioProxyService {
  /**
   * Obtenir l'URL audio en interrogeant le service.
   */
  async getAudioUrl(trackId: string, quality: string = 'FLAC'): Promise<{ url: string; duration?: number } | null> {
    console.log(`🚀 Récupération URL pour ${trackId} via frankfurt.monochrome.tf...`);

    try {
      const result = await this.tryDeezmateProxy(trackId);
      if (result) {
        console.log(`✅ URL trouvée pour ${trackId}:`, result.url.substring(0, 70) + "...");
        return result;
      }
      throw new Error("Aucun résultat du proxy");
    } catch (error) {
      console.error(`❌ La source a échoué pour ${trackId}:`, error);
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
    console.log("🎵 Tentative Deezmate Proxy (via frankfurt.monochrome.tf)...");
    const promise = supabase.functions.invoke('deezmate-proxy', {
      body: { trackId },
    });

    const { data, error } = await this.withTimeout(promise, PROXY_TIMEOUT, 'Deezmate');

    if (error) throw new Error(`Deezmate Proxy a échoué: ${error.message}`);
    if (!data.success || !data.links?.flac) throw new Error('Réponse Deezmate invalide');
    
    return { url: data.links.flac };
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