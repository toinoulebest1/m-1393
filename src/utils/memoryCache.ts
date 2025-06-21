
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

class MemoryAudioCache {
  private cache = new Map<string, string>();
  private metadata = new Map<string, MemoryCacheEntry>();
  private maxSize = 50; // Maximum 50 URLs en mémoire
  private ttl = 30 * 60 * 1000; // 30 minutes TTL

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
      entries: Array.from(this.metadata.values()).map(entry => ({
        url: entry.url,
        age: Date.now() - entry.timestamp,
        accessCount: entry.accessCount,
        lastAccessed: Date.now() - entry.lastAccessed
      }))
    };
  }

  /**
   * Préchargement en lot
   */
  async preloadBatch(songUrls: string[]): Promise<void> {
    console.log("🚀 Préchargement batch:", songUrls.length, "URLs");
    
    const promises = songUrls.map(async (songUrl) => {
      if (this.has(songUrl)) return; // Déjà en cache
      
      try {
        const { getAudioFileUrl } = await import('./storage');
        const audioUrl = await getAudioFileUrl(songUrl);
        if (audioUrl && typeof audioUrl === 'string') {
          this.set(songUrl, audioUrl);
        }
      } catch (error) {
        console.warn("⚠️ Erreur préchargement:", songUrl, error);
      }
    });
    
    await Promise.allSettled(promises);
  }
}

// Instance singleton
export const memoryCache = new MemoryAudioCache();

// Nettoyage automatique toutes les 5 minutes
setInterval(() => {
  memoryCache.cleanup();
}, 5 * 60 * 1000);
