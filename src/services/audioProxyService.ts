/**
 * Service de proxy audio pour Deezer.
 * Expose des méthodes distinctes pour chaque source (Deezmate, Flacdownloader)
 * pour permettre une orchestration fine côté client.
 */
import { supabase } from '@/integrations/supabase/client';

const PROXY_TIMEOUT = 3000; // 3 secondes

class AudioProxyService {
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
  async tryDeezmate(trackId: string): Promise<{ url: string; duration?: number }> {
    console.log("🎵 Tentative Deezmate Proxy...");
    const promise = supabase.functions.invoke('deezmate-proxy', {
      body: { trackId },
    });

    const { data, error } = await this.withTimeout(promise, PROXY_TIMEOUT, 'Deezmate');

    if (error) throw new Error(`Deezmate Proxy a échoué: ${error.message}`);
    if (!data.success || !data.links?.flac) throw new Error('Réponse Deezmate invalide ou pas de lien FLAC');
    
    console.log("✅ Deezmate a retourné une URL.");
    return { url: data.links.flac };
  }

  /**
   * Essayer le proxy Flacdownloader.
   * Retourne directement l'URL du proxy pour que le navigateur la streame.
   */
  async tryFlacdownloader(trackId: string): Promise<{ url: string; duration?: number }> {
    console.log("🎵 Tentative Flacdownloader Proxy...");
    const proxyUrl = `${supabase.functions.getURL('flacdownloader-proxy')}?deezerId=${trackId}`;
    
    // Ici, on ne peut pas valider l'URL en amont, on retourne juste l'URL du proxy.
    // Le "watchdog" côté client se chargera de la validation.
    console.log("✅ Flacdownloader a construit une URL de proxy.");
    return Promise.resolve({ url: proxyUrl });
  }
}

// Instance singleton
export const audioProxyService = new AudioProxyService();