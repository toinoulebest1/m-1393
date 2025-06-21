
/**
 * Cache mémoire ultra-rapide pour les URLs audio
 * Version ultra-conservatrice pour éviter les erreurs console
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
  private maxSize = 20; // Réduit pour être plus conservateur
  private ttl = 20 * 60 * 1000; // 20 minutes TTL
  private preloadingUrls = new Set<string>(); // Suivi des URLs en cours de préchargement
  private failedUrls = new Set<string>(); // URLs qui ont échoué

  /**
   * Vérification ultra-rapide (< 1ms)
   */
  has(songUrl: string): boolean {
    // Si l'URL a déjà échoué, retourner false immédiatement
    if (this.failedUrls.has(songUrl)) {
      return false;
    }
    
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
    // Retirer des URLs échouées si succès
    this.failedUrls.delete(songUrl);
    
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
   * Marquer une URL comme échouée
   */
  markAsFailed(songUrl: string): void {
    this.failedUrls.add(songUrl);
    this.delete(songUrl); // Supprimer du cache principal
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
    
    // Nettoyer les URLs échouées si trop nombreuses
    if (this.failedUrls.size > 50) {
      this.failedUrls.clear();
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
      failedUrls: this.failedUrls.size,
      entries: Array.from(this.metadata.values()).map(entry => ({
        url: entry.url,
        age: Date.now() - entry.timestamp,
        accessCount: entry.accessCount,
        lastAccessed: Date.now() - entry.lastAccessed
      }))
    };
  }

  /**
   * Préchargement ultra-conservateur avec gestion silencieuse des erreurs
   */
  async preloadBatch(urls: string[]): Promise<void> {
    if (urls.length === 0) return;
    
    // Filtrer les URLs déjà en cache ou échouées
    const urlsToPreload = urls.filter(url => 
      !this.cache.has(url) && 
      !this.preloadingUrls.has(url) && 
      !this.failedUrls.has(url)
    );
    
    if (urlsToPreload.length === 0) {
      return; // Pas de log pour éviter le spam
    }
    
    // Traiter seulement 1 URL à la fois pour être ultra-conservateur
    for (const url of urlsToPreload.slice(0, 1)) { // Seulement la première URL
      if (this.preloadingUrls.has(url) || this.failedUrls.has(url)) {
        continue;
      }
      
      this.preloadingUrls.add(url);
      
      try {
        const audioUrl = await import('@/utils/storage').then(m => m.getAudioFileUrl(url));
        
        // Vérifier si toujours pas en cache après le délai
        if (!this.cache.has(url)) {
          this.set(url, audioUrl);
        }
      } catch (error) {
        // Marquer comme échoué silencieusement
        this.markAsFailed(url);
        // Pas de log d'erreur pour éviter le spam console
      } finally {
        this.preloadingUrls.delete(url);
      }
      
      // Une seule URL pour être ultra-conservateur
      break;
    }
  }
}

// Instance singleton
export const memoryCache = new MemoryCache();

// Nettoyage automatique toutes les 10 minutes (plus conservateur)
setInterval(() => {
  memoryCache.cleanup();
}, 10 * 60 * 1000);
