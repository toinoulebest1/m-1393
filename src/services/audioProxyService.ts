/**
 * Service de proxy audio multi-instances avec sélection automatique
 * Supporte le décodage de manifestes Base64 et tolérance aux erreurs
 */
import { durationToSeconds } from '@/utils/mediaSession';

interface ProxyInstance {
  url: string;
  latency: number;
  lastError?: number;
  consecutiveErrors: number;
}

interface ManifestResponse {
  urls: string[];
  quality?: string;
  id?: string;
}

interface CachedUrl {
  url: string;
  timestamp: number;
  quality: string;
  duration?: number;
}

class AudioProxyService {
  private instances: ProxyInstance[] = [];
  private currentInstance: ProxyInstance | null = null;
  private urlCache = new Map<string, CachedUrl>();
  private readonly URL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 50;
  private readonly RETRY_DELAY = 1000;
  private readonly MAX_RETRIES = 2;
  private readonly ERROR_COOLDOWN = 30000; // 30 secondes
  private initialized = false;

  /**
   * Initialiser le service avec test de latence des instances
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log("🔌 Initialisation du proxy audio...");
      
      // Charger les instances
      console.log("📂 Chargement de /instances.json...");
      const response = await fetch('/instances.json');
      
      if (!response.ok) {
        throw new Error(`Impossible de charger instances.json: ${response.status} ${response.statusText}`);
      }
      
      const instanceUrls: string[] = await response.json();
      console.log(`📋 ${instanceUrls.length} instances trouvées:`, instanceUrls);
      
      // Ne plus faire de test de latence, on suppose qu'elles sont toutes dispo au début.
      // La course dans getAudioUrl se chargera de trouver la meilleure.
      this.instances = instanceUrls.map(url => ({
        url,
        latency: 0, // On ne teste plus, on met une valeur par défaut
        consecutiveErrors: 0,
      }));
      
      this.currentInstance = this.instances.length > 0 ? this.instances[0] : null;
      
      if (!this.currentInstance) {
        console.error("❌ AUCUNE instance configurée dans instances.json !");
      } else {
        console.log("✅ Proxy initialisé. " + this.instances.length + " instances chargées.");
      }
      
      this.initialized = true;
    } catch (error) {
      console.error("❌ Erreur initialisation proxy:", error);
      throw error;
    }
  }

  /**
   * Obtenir l'URL audio via le proxy en interrogeant toutes les instances en parallèle
   * La première réponse valide gagne
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

    // Filtrer les instances disponibles
    const availableInstances = this.instances.filter(i => 
      !i.lastError || Date.now() - i.lastError > this.ERROR_COOLDOWN
    );

    if (availableInstances.length === 0) {
      console.error("❌ Aucune instance disponible");
      return null;
    }
    
    console.log(`🏁 Course entre ${availableInstances.length} instances pour ${trackId}...`);
    console.log("📋 Instances participantes:", availableInstances.map(i => i.url).join(', '));

    // Lancer des appels parallèles à TOUTES les instances
    const racePromises = availableInstances.map(instance => 
      this.fetchFromInstance(instance, trackId, quality)
    );

    try {
      // Attendre la première réponse valide
      const result = await Promise.race(
        racePromises.map(async (promise, index) => {
          try {
            const res = await promise;
            if (res) {
              console.log(`🏆 GAGNANT: ${availableInstances[index].url}`);
              this.currentInstance = availableInstances[index];
              return res;
            }
            throw new Error('Réponse invalide');
          } catch (error) {
            // Cette instance a échoué, on attend les autres
            throw error;
          }
        })
      );

      // Mettre en cache et retourner
      if (result) {
        this.cacheUrl(cacheKey, result.url, quality, result.duration);
        return result;
      }
    } catch (error) {
      console.warn("⚠️ Première instance a échoué, attente des autres...");
    }

    // Si la première a échoué, attendre toutes les autres avec Promise.allSettled
    const allResults = await Promise.allSettled(racePromises);
    
    // Chercher la première réponse valide
    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i];
      if (result.status === 'fulfilled' && result.value) {
        console.log(`✅ Succès avec ${availableInstances[i].url}`);
        this.currentInstance = availableInstances[i];
        this.cacheUrl(cacheKey, result.value.url, quality, result.value.duration);
        return result.value;
      } else if (result.status === 'rejected') {
        // Marquer l'erreur pour cette instance
        availableInstances[i].consecutiveErrors++;
        availableInstances[i].lastError = Date.now();
      }
    }

    console.error("❌ Toutes les instances ont échoué pour:", trackId);
    return null;
  }

  /**
   * Récupérer depuis une instance spécifique (pour la course parallèle)
   */
  private async fetchFromInstance(instance: ProxyInstance, trackId: string, quality: string): Promise<{ url: string; duration?: number } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const url = `${instance.url}/track/?id=${trackId}&quality=${quality}`;
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      let trackUrl: string | undefined;
      let duration: number | undefined;

      // --- Extraction de l'URL ---
      // Cas 1: Tableau Tidal
      if (Array.isArray(data) && data.length >= 3 && data[2]?.OriginalTrackUrl) {
        trackUrl = data[2].OriginalTrackUrl;
      }
      // Cas 2: Manifeste Base64
      else if (typeof data === 'string' && data.startsWith('ey')) {
        const manifest = JSON.parse(atob(data));
        if (manifest.urls && manifest.urls.length > 0) {
          trackUrl = manifest.urls[0];
          // Vérifier la durée à l'intérieur du manifeste
          if ((manifest as any).duration) {
            const parsedDuration = durationToSeconds((manifest as any).duration);
            if (parsedDuration > 0) duration = parsedDuration;
          }
        }
      }
      // Cas 3: JSON direct avec urls[]
      else if (data.urls && Array.isArray(data.urls) && data.urls.length > 0) {
        trackUrl = data.urls[0];
      }
      // Cas 4: URL directe
      else if (typeof data === 'string' && data.startsWith('http')) {
        trackUrl = data;
      }

      // --- Extraction de la durée ---
      // Si la durée n'a pas encore été trouvée, vérifier les emplacements courants
      if (duration === undefined) {
        // Depuis l'objet racine
        if (data?.duration) {
          const parsedDuration = durationToSeconds(data.duration);
          if (parsedDuration > 0) duration = parsedDuration;
        }
        // Depuis les métadonnées Tidal
        else if (Array.isArray(data) && data[0]?.duration) {
          const parsedDuration = durationToSeconds(data[0].duration);
          if (parsedDuration > 0) duration = parsedDuration;
        }
      }

      if (trackUrl && typeof trackUrl === 'string' && trackUrl.startsWith('http')) {
        if (duration) console.log(`✅ Durée de ${duration}s trouvée pour ${trackId}`);
        return { url: trackUrl, duration };
      }

      throw new Error('Format de réponse invalide ou URL non trouvée');
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }


  /**
   * Mettre en cache une URL
   */
  private cacheUrl(key: string, url: string, quality: string, duration?: number): void {
    // Limiter la taille du cache
    if (this.urlCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.urlCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.urlCache.delete(oldestKey);
    }

    this.urlCache.set(key, {
      url,
      quality,
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
      currentInstance: this.currentInstance?.url,
      instancesCount: this.instances.length,
      cacheSize: this.urlCache.size,
      instances: this.instances.map(i => ({
        url: i.url,
        latency: i.latency,
        errors: i.consecutiveErrors
      }))
    };
  }
}

// Instance singleton
export const audioProxyService = new AudioProxyService();

// Nettoyage périodique du cache (toutes les 5 minutes)
setInterval(() => {
  audioProxyService.cleanupCache();
}, 5 * 60 * 1000);