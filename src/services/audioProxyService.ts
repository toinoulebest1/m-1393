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
  score: number; // Ajout du score de santé
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
  private readonly MAX_CACHE_SIZE = 100; // Augmentation du cache
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
        latency: 300, // Latence moyenne de départ
        consecutiveErrors: 0,
        score: 1000, // Score de départ
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
   * Classe les instances en fonction de leur score de santé.
   * Le score pénalise la latence élevée et les erreurs récentes.
   */
  private sortInstances(): ProxyInstance[] {
    const now = Date.now();
    this.instances.forEach(instance => {
      let score = 1000;
      // Pénalité pour la latence (moyenne pondérée simple)
      score -= instance.latency * 0.5;
      // Pénalité lourde pour les erreurs consécutives
      score -= instance.consecutiveErrors * 250;
      // Pénalité si l'erreur est très récente
      if (instance.lastError && now - instance.lastError < this.ERROR_COOLDOWN / 2) {
        score -= 500;
      }
      instance.score = Math.max(0, score); // Le score ne peut pas être négatif
    });

    return [...this.instances].sort((a, b) => b.score - a.score);
  }

  /**
   * Obtenir l'URL audio via le proxy en interrogeant les meilleures instances en parallèle.
   * La première réponse valide gagne et annule les autres.
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

    // Trier les instances par score de santé
    const sortedInstances = this.sortInstances();
    const instancesToRace = sortedInstances; // Utiliser toutes les instances

    if (instancesToRace.length === 0) {
      console.error("❌ Aucune instance disponible");
      return null;
    }
    
    console.log(`🏁 Course entre les ${instancesToRace.length} instances pour ${trackId}...`);
    console.log("📋 Instances participantes:", instancesToRace.map(i => `${i.url} (score: ${i.score.toFixed(0)})`).join(', '));

    const controllers = instancesToRace.map(() => new AbortController());
    
    const racePromises = instancesToRace.map((instance, index) => 
      this.fetchFromInstance(instance, trackId, quality, controllers[index].signal)
        .then(result => {
          // Annuler les autres requêtes dès qu'on a un gagnant
          controllers.forEach((c, i) => {
            if (i !== index) c.abort();
          });
          return result;
        })
    );

    try {
      const result = await Promise.race(racePromises);
      if (result) {
        this.cacheUrl(cacheKey, result.url, quality, result.duration);
        return { url: result.url, duration: result.duration };
      }
    } catch (error) {
      // Promise.race rejette dès qu'une promesse rejette.
      // On continue pour voir si une autre réussit.
    }

    // Si la course a échoué, on attend toutes les réponses pour trouver un succès
    const allResults = await Promise.allSettled(racePromises);
    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i];
      if (result.status === 'fulfilled' && result.value) {
        const winnerInstance = instancesToRace[i];
        console.log(`✅ Succès (fallback) avec ${winnerInstance.url}`);
        this.currentInstance = winnerInstance;
        this.cacheUrl(cacheKey, result.value.url, quality, result.value.duration);
        return { url: result.value.url, duration: result.value.duration };
      }
    }

    console.error("❌ Toutes les instances ont échoué pour:", trackId);
    return null;
  }

  /**
   * Récupérer depuis une instance spécifique (pour la course parallèle)
   */
  private async fetchFromInstance(instance: ProxyInstance, trackId: string, quality: string, signal: AbortSignal): Promise<{ url: string; duration?: number; latency: number } | null> {
    const startTime = performance.now();
    
    try {
      const url = `${instance.url}/track/?id=${trackId}&quality=${quality}`;
      
      const response = await fetch(url, {
        signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      const latency = performance.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      let trackUrl: string | undefined;
      let duration: number | undefined;

      // --- Décodage robuste du manifeste ---
      try {
        let manifest: any = {};
        if (typeof data === 'string' && data.startsWith('ey')) {
          manifest = JSON.parse(atob(data));
        } else if (typeof data === 'object' && data !== null) {
          manifest = data;
        }

        if (Array.isArray(manifest) && manifest.length >= 3 && manifest[2]?.OriginalTrackUrl) {
          trackUrl = manifest[2].OriginalTrackUrl;
        } else if (manifest.urls && Array.isArray(manifest.urls) && manifest.urls.length > 0) {
          trackUrl = manifest.urls[0];
        } else if (typeof manifest === 'string' && manifest.startsWith('http')) {
          trackUrl = manifest;
        }

        if (manifest.duration) {
          const parsedDuration = durationToSeconds(manifest.duration);
          if (parsedDuration > 0) duration = parsedDuration;
        } else if (Array.isArray(manifest) && manifest[0]?.duration) {
          const parsedDuration = durationToSeconds(manifest[0].duration);
          if (parsedDuration > 0) duration = parsedDuration;
        }
      } catch (e) {
        throw new Error('Format de manifeste invalide');
      }


      if (trackUrl && typeof trackUrl === 'string' && trackUrl.startsWith('http')) {
        // Succès : mise à jour de la santé de l'instance
        instance.latency = (instance.latency * 0.7) + (latency * 0.3); // Moyenne pondérée
        instance.consecutiveErrors = 0;
        if (duration) console.log(`✅ Durée de ${duration}s trouvée pour ${trackId}`);
        return { url: trackUrl, duration, latency };
      }

      throw new Error('URL non trouvée dans le manifeste');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`⏹️ Requête annulée pour ${instance.url}`);
      } else {
        // Échec : mise à jour de la santé de l'instance
        instance.consecutiveErrors++;
        instance.lastError = Date.now();
        console.warn(`⚠️ Échec pour ${instance.url}:`, error.message);
      }
      throw error; // Renvoyer l'erreur pour que Promise.race/allSettled puisse la gérer
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
      instances: this.sortInstances().map(i => ({ // Afficher les instances triées
        url: i.url,
        score: i.score.toFixed(0),
        latency: i.latency.toFixed(0),
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