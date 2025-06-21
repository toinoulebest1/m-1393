/**
 * Cache mémoire ultra-rapide pour les URLs audio
 * Complète le cache IndexedDB pour des accès sub-milliseconde
 */

interface MemoryCacheEntry {
  url: string;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
}

class MemoryCache {
  private cache = new Map<string, string>();
  private metadata = new Map<string, MemoryCacheEntry>();
  private maxSize = 50; // Maximum 50 URLs en mémoire
  private ttl = 30 * 60 * 1000; // 30 minutes TTL
  private preloadingUrls = new Set<string>(); // Suivi des URLs en cours de préchargement

  /**
   * Vérification ultra-rapide (< 1ms)
   */
  has(songUrl: string): boolean {
    const entry = this.metadata.get(songUrl);
    if (!entry) return false;
    
    // Vérifier TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(songUrl);
      return false;
    }
    
    return this.cache.has(songUrl);
  }

  /**
   * Récupération ultra-rapide (< 1ms)
   */
  get(songUrl: string): string | null {
    if (!this.has(songUrl)) return null;
    
    const audioUrl = this.cache.get(songUrl);
    if (!audioUrl) return null;
    
    // Mettre à jour les statistiques d'accès
    const entry = this.metadata.get(songUrl);
    if (entry) {
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      this.metadata.set(songUrl, entry);
    }
    
    console.log("⚡ Cache mémoire HIT:", songUrl);
    return audioUrl;
  }

  /**
   * Ajout avec éviction LRU intelligente
   */
  set(songUrl: string, audioUrl: string): void {
    // Éviction si cache plein
    if (this.cache.size >= this.maxSize && !this.cache.has(songUrl)) {
      this.evictLeastUsed();
    }
    
    this.cache.set(songUrl, audioUrl);
    this.metadata.set(songUrl, {
      url: songUrl,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1
    });
    
    console.log("💾 Cache mémoire SET:", songUrl);
  }

  /**
   * Éviction intelligente basée sur LRU + fréquence
   */
  private evictLeastUsed(): void {
    let oldestEntry: [string, MemoryCacheEntry] | null = null;
    let lowestScore = Infinity;
    
    for (const [key, entry] of this.metadata.entries()) {
      // Score = fréquence × récence (plus élevé = plus important)
      const recency = Date.now() - entry.lastAccessed;
      const score = entry.accessCount / (1 + recency / 1000); // Normaliser par secondes
      
      if (score < lowestScore) {
        lowestScore = score;
        oldestEntry = [key, entry];
      }
    }
    
    if (oldestEntry) {
      this.delete(oldestEntry[0]);
      console.log("🗑️ Éviction cache mémoire:", oldestEntry[0]);
    }
  }

  /**
   * Suppression
   */
  delete(songUrl: string): void {
    this.cache.delete(songUrl);
    this.metadata.delete(songUrl);
    this.preloadingUrls.delete(songUrl);
  }

  /**
   * Nettoyage des entrées expirées
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.metadata.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.delete(key);
      }
    }
  }

  /**
   * Statistiques du cache
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      preloadingCount: this.preloadingUrls.size,
      entries: Array.from(this.metadata.values()).map(entry => ({
        url: entry.url,
        age: Date.now() - entry.timestamp,
        accessCount: entry.accessCount,
        lastAccessed: Date.now() - entry.lastAccessed
      }))
    };
  }

  /**
   * Préchargement en lot ultra-optimisé avec protection contre les doublons
   */
  async preloadBatch(urls: string[]): Promise<void> {
    if (urls.length === 0) return;
    
    console.log("🎯 Préchargement batch ultra-optimisé:", urls.length, "URLs");
    
    // Filtrer les URLs déjà en cache ou en cours de préchargement
    const urlsToPreload = urls.filter(url => 
      !this.cache.has(url) && !this.preloadingUrls.has(url)
    );
    
    if (urlsToPreload.length === 0) {
      console.log("✅ Toutes les URLs sont déjà en cache ou en cours de préchargement");
      return;
    }
    
    console.log("📦 URLs à précharger:", urlsToPreload.length);
    
    // Marquer les URLs comme en cours de préchargement
    urlsToPreload.forEach(url => this.preloadingUrls.add(url));
    
    try {
      // Traiter seulement 1 URL à la fois pour éviter la surcharge
      for (let i = 0; i < urlsToPreload.length; i++) {
        const url = urlsToPreload[i];
        
        try {
          // Vérifier encore une fois si pas déjà en cache
          if (this.cache.has(url)) {
            console.log("⚡ Déjà en cache pendant le préchargement:", url);
            continue;
          }
          
          // Délai progressif pour éviter la surcharge
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000 * i));
          }
          
          const audioUrl = await import('@/utils/storage').then(m => m.getAudioFileUrl(url));
          
          // Vérifier si toujours pas en cache après le délai
          if (!this.cache.has(url)) {
            this.set(url, audioUrl);
            console.log("✅ Préchargé avec succès:", url);
          }
        } catch (error) {
          console.warn("⚠️ Échec préchargement (ignoré):", url, error);
          // Ne pas loguer d'erreur pour éviter le spam console
        } finally {
          // Retirer de la liste des préchargements en cours
          this.preloadingUrls.delete(url);
        }
      }
    } finally {
      // Nettoyer toutes les URLs en cours de préchargement
      urlsToPreload.forEach(url => this.preloadingUrls.delete(url));
    }
    
    console.log("🎯 Préchargement batch terminé silencieusement");
  }
}

// Instance singleton
export const memoryCache = new MemoryCache();

// Nettoyage automatique toutes les 5 minutes
setInterval(() => {
  memoryCache.cleanup();
}, 5 * 60 * 1000);
