/**
 * Service de proxy audio multi-instances avec sélection automatique
 * Supporte le décodage de manifestes Base64 et tolérance aux erreurs
 */

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
      
      // Tester la latence de chaque instance en parallèle
      console.log("⏱️ Test de latence en cours...");
      const latencyTests = instanceUrls.map(url => this.testLatency(url));
      const results = await Promise.allSettled(latencyTests);
      
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value < Infinity).length;
      console.log(`📊 Tests terminés: ${successCount}/${instanceUrls.length} instances répondent`);
      
      this.instances = results
        .map((result, index) => ({
          url: instanceUrls[index],
          latency: result.status === 'fulfilled' ? result.value : Infinity,
          consecutiveErrors: result.status === 'fulfilled' ? 0 : 1
        }))
        .sort((a, b) => a.latency - b.latency);
      
      // Sélectionner la meilleure instance
      this.currentInstance = this.instances.find(i => i.latency < Infinity) || null;
      
      if (!this.currentInstance) {
        console.error("❌ AUCUNE instance disponible ! Toutes ont échoué au test.");
        console.error("🔍 Détails des instances:", this.instances.map(i => 
          `${i.url}: latency=${i.latency}ms, errors=${i.consecutiveErrors}`
        ));
      } else {
        console.log("✅ Proxy initialisé. Instance la plus rapide:", this.currentInstance.url, `(${this.currentInstance.latency}ms)`);
        console.log("📊 Instances disponibles:", this.instances.filter(i => i.latency < Infinity).map(i => `${i.url} (${i.latency}ms)`).join(', '));
      }
      
      this.initialized = true;
    } catch (error) {
      console.error("❌ Erreur initialisation proxy:", error);
      throw error;
    }
  }

  /**
   * Tester la latence d'une instance
   */
  private async testLatency(instanceUrl: string): Promise<number> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s pour tenir compte du réseau
    
    try {
      console.log(`🔍 Test latence: ${instanceUrl}/track/?id=157172496&quality=LOSSLESS`);
      const start = performance.now();
      
      // Tester avec une vraie requête track (HEAD pour économiser bande passante)
      const response = await fetch(`${instanceUrl}/track/?id=157172496&quality=LOSSLESS`, {
        signal: controller.signal,
        method: 'HEAD' // HEAD pour ne pas télécharger tout l'audio
      });
      
      clearTimeout(timeout);
      
      console.log(`📡 Réponse ${instanceUrl}: ${response.status} ${response.statusText}`);
      
      if (response.ok || response.status === 200) {
        const latency = performance.now() - start;
        console.log(`✅ ${instanceUrl}: ${latency.toFixed(0)}ms`);
        return latency;
      }
      
      console.warn(`❌ ${instanceUrl}: HTTP ${response.status} - non OK`);
      return Infinity;
    } catch (error: any) {
      clearTimeout(timeout);
      const errorType = error.name === 'AbortError' ? 'TIMEOUT' : error.name;
      console.error(`❌ ${instanceUrl}: ${errorType} - ${error.message}`);
      return Infinity;
    }
  }

  /**
   * Obtenir l'URL audio via le proxy en testant toutes les instances
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

    // Essayer TOUTES les instances disponibles (pas juste retry sur la même)
    const availableInstances = this.instances.filter(i => 
      !i.lastError || Date.now() - i.lastError > this.ERROR_COOLDOWN
    );

    if (availableInstances.length === 0) {
      console.error("❌ Aucune instance disponible");
      console.error("🔍 État des instances:", this.instances.map(i => ({
        url: i.url,
        latency: i.latency,
        lastError: i.lastError ? new Date(i.lastError).toISOString() : 'none',
        consecutiveErrors: i.consecutiveErrors,
        cooldownRemaining: i.lastError ? Math.max(0, this.ERROR_COOLDOWN - (Date.now() - i.lastError)) : 0
      })));
      return null;
    }
    
    console.log(`🎯 ${availableInstances.length} instances disponibles pour essai`);
    console.log("📋 Instances:", availableInstances.map(i => `${i.url} (${i.latency}ms)`).join(', '));

    // Essayer chaque instance jusqu'à trouver une qui fonctionne
    for (const instance of availableInstances) {
      try {
        console.log(`🌐 Tentative avec ${instance.url}...`);
        this.currentInstance = instance;
        
        const result = await this.fetchAudioUrl(trackId, quality);
        if (result) {
          // Succès ! Mettre en cache et retourner
          this.cacheUrl(cacheKey, result.url, quality, result.duration);
          console.log(`✅ Succès avec ${instance.url}`);
          return result;
        }
      } catch (error: any) {
        console.warn(`⚠️ ${instance.url} échec:`, error.message, `(status: ${error.status})`);
        
        // Marquer l'erreur pour cette instance
        this.markInstanceError();
        
        // Continuer avec l'instance suivante
        continue;
      }
    }

    console.error("❌ Toutes les instances ont échoué pour:", trackId);
    return null;
  }

  /**
   * Récupérer l'URL audio depuis l'instance courante
   */
  private async fetchAudioUrl(trackId: string, quality: string): Promise<{ url: string; duration?: number } | null> {
    if (!this.currentInstance) {
      throw new Error("Aucune instance disponible");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // Réduit à 8s pour plus de réactivité

    try {
      const url = `${this.currentInstance.url}/track/?id=${trackId}&quality=${quality}`;
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        // Créer une erreur avec le status code pour la gestion d'erreur
        const error: any = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        
        // Tenter de lire le message d'erreur
        try {
          const errorData = await response.json();
          if (errorData.error) {
            error.message = `${response.status}: ${errorData.error}`;
          }
        } catch (e) {
          // Ignore si impossible de parser le JSON
        }
        
        throw error;
      }

      const data = await response.json();
      
      // Cas 1: Tableau Tidal [metadata, manifest, {OriginalTrackUrl}]
      if (Array.isArray(data) && data.length >= 3) {
        const metadata = data[0];
        const trackUrl = data[2]?.OriginalTrackUrl;
        if (trackUrl && typeof trackUrl === 'string' && trackUrl.startsWith('http')) {
          // Extraire la durée depuis metadata.duration
          const duration = metadata?.duration ? Number(metadata.duration) : undefined;
          console.log("✅ URL extraite depuis tableau Tidal (OriginalTrackUrl)");
          if (duration) {
            console.log("✅ Durée extraite depuis data[0].duration:", duration, "secondes");
          }
          return { url: trackUrl, duration };
        }
      }
      
      // Cas 2: Manifeste Base64
      if (typeof data === 'string' && data.startsWith('ey')) {
        const manifest: ManifestResponse = JSON.parse(atob(data));
        if (manifest.urls && manifest.urls.length > 0) {
          console.log("✅ URL décodée depuis manifeste Base64");
          return { url: manifest.urls[0] };
        }
      }
      
      // Cas 3: JSON direct avec urls[]
      if (data.urls && Array.isArray(data.urls) && data.urls.length > 0) {
        console.log("✅ URL extraite depuis JSON");
        return { url: data.urls[0] };
      }
      
      // Cas 4: URL directe dans la réponse
      if (typeof data === 'string' && data.startsWith('http')) {
        console.log("✅ URL directe reçue");
        return { url: data };
      }

      console.warn("⚠️ Format de réponse inconnu ou vide:", data);
      
      // Si format inconnu, considérer comme erreur
      const error: any = new Error('Format de réponse invalide');
      error.status = 500;
      throw error;
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
   * Marquer une erreur pour l'instance courante
   */
  private markInstanceError(): void {
    if (this.currentInstance) {
      this.currentInstance.consecutiveErrors++;
      this.currentInstance.lastError = Date.now();
      console.warn(`⚠️ Erreur instance ${this.currentInstance.url} (${this.currentInstance.consecutiveErrors} consécutives)`);
    }
  }

  /**
   * Basculer vers la prochaine instance disponible
   */
  private switchToNextInstance(): void {
    if (!this.currentInstance || this.instances.length <= 1) return;

    // Filtrer les instances sans erreur récente
    const availableInstances = this.instances.filter(i => 
      !i.lastError || Date.now() - i.lastError > this.ERROR_COOLDOWN
    );

    if (availableInstances.length === 0) {
      console.warn("⚠️ Toutes les instances en cooldown, réinitialisation");
      this.instances.forEach(i => {
        i.lastError = undefined;
        i.consecutiveErrors = 0;
      });
      return;
    }

    // Trouver la prochaine instance
    const currentIndex = this.instances.indexOf(this.currentInstance);
    let nextIndex = (currentIndex + 1) % this.instances.length;
    
    // Chercher une instance sans erreur récente
    let attempts = 0;
    while (attempts < this.instances.length) {
      const candidate = this.instances[nextIndex];
      if (!candidate.lastError || Date.now() - candidate.lastError > this.ERROR_COOLDOWN) {
        this.currentInstance = candidate;
        console.log("🔄 Basculement vers:", this.currentInstance.url);
        return;
      }
      nextIndex = (nextIndex + 1) % this.instances.length;
      attempts++;
    }
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
