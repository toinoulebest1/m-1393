/**
 * Cache L0 Ultra-Rapide - Variables globales pour accès sub-milliseconde
 * Plus rapide que le cache mémoire grâce aux variables globales
 */

interface L0CacheEntry {
  songUrl: string;
  audioUrl: string;
  blob: Blob;
  timestamp: number;
  accessCount: number;
}

// Cache L0 global - 3 dernières chansons en variables globales
let l0Cache: L0CacheEntry[] = [];
const L0_MAX_SIZE = 3;

// Pre-warmed audio URLs pour accès instantané avec TTL pour éviter les URLs expirées
const WARM_TTL_MS = 2 * 60 * 1000; // 2 minutes
const warmCache = new Map<string, { url: string; ts: number }>();

export class UltraFastCache {
  /**
   * Vérification ultra-instantanée (< 0.1ms)
   */
  static hasL0(songUrl: string): boolean {
    return l0Cache.some(entry => entry.songUrl === songUrl);
  }

  /**
   * Récupération ultra-instantanée (< 0.1ms)
   */
  static getL0(songUrl: string): string | null {
    const entry = l0Cache.find(e => e.songUrl === songUrl);
    if (!entry) return null;
    
    // Mettre en tête pour LRU
    const index = l0Cache.indexOf(entry);
    if (index > 0) {
      l0Cache.splice(index, 1);
      l0Cache.unshift(entry);
    }
    
    entry.accessCount++;
    console.log("⚡ L0 CACHE HIT:", songUrl, "- < 0.1ms");
    return entry.audioUrl;
  }

  /**
   * Ajout L0 avec éviction intelligente
   */
  static setL0(songUrl: string, audioUrl: string, blob: Blob): void {
    // Éviction si plein
    if (l0Cache.length >= L0_MAX_SIZE) {
      const evicted = l0Cache.pop();
      if (evicted) {
        URL.revokeObjectURL(evicted.audioUrl);
        console.log("🗑️ L0 éviction:", evicted.songUrl);
      }
    }
    
    // Ajouter en tête
    l0Cache.unshift({
      songUrl,
      audioUrl,
      blob,
      timestamp: Date.now(),
      accessCount: 1
    });
    
    console.log("💾 L0 CACHE SET:", songUrl);
  }

  /**
   * Warm cache pour URLs pré-calculées
   */
static setWarm(songUrl: string, audioUrl: string): void {
    warmCache.set(songUrl, { url: audioUrl, ts: Date.now() });
    console.log("🔥 WARM CACHE:", songUrl);
  }

static getWarm(songUrl: string): string | null {
    const entry = warmCache.get(songUrl);
    if (!entry) return null;

    // Invalider si expiré
    if (Date.now() - entry.ts > WARM_TTL_MS) {
      warmCache.delete(songUrl);
      console.log("⏰ WARM EXPIRED:", songUrl);
      return null;
    }

    console.log("🔥 WARM HIT:", songUrl);
    return entry.url;
  }

  /**
   * Statistiques du cache ultra-rapide
   */
  static getStats() {
    return {
      l0Size: l0Cache.length,
      warmSize: warmCache.size,
      l0Entries: l0Cache.map(e => ({
        url: e.songUrl,
        age: Date.now() - e.timestamp,
        accessCount: e.accessCount
      }))
    };
  }

  /**
   * Nettoyage pour éviter les fuites mémoire
   */
  static cleanup(): void {
    l0Cache.forEach(entry => URL.revokeObjectURL(entry.audioUrl));
    l0Cache = [];
    warmCache.clear();
    console.log("🧹 L0 Cache nettoyé");
  }

  static async getAudioUrlUltraFast(filePath: string, songTitle?: string, songArtist?: string, songId?: string): Promise<{ url: string; duration?: number }> {
    const cacheKey = songId || filePath;
    const logTag = `[UltraFastCache for "${songTitle || cacheKey}"]`;

    if (this.cache.has(cacheKey)) {
      console.log(`${logTag} ✅ URL récupérée depuis le cache L0.`);
      return this.cache.get(cacheKey)!.data;
    }

    console.log(`${logTag} 🏁 URL non trouvée dans le cache L0. Démarrage de la récupération...`);
    
    // Utiliser une promesse pour éviter les requêtes multiples pour la même ressource
    if (this.promiseCache.has(cacheKey)) {
      console.log(`${logTag} ⏳ Une récupération est déjà en cours, en attente du résultat...`);
      return this.promiseCache.get(cacheKey)!;
    }

    const promise = getAudioFileUrl(filePath, songTitle, songArtist, songId)
      .then(data => {
        console.log(`${logTag} ✅ Récupération terminée. Mise en cache L0.`);
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        this.promiseCache.delete(cacheKey); // Nettoyer la promesse une fois résolue
        return data;
      })
      .catch(error => {
        this.promiseCache.delete(cacheKey); // Nettoyer en cas d'erreur aussi
        throw error;
      });

    this.promiseCache.set(cacheKey, promise);
    return promise;
  }

  static cleanup() {
    this.cache.clear();
    this.promiseCache.clear();
    console.log('🧹 Cache L0 ultra-rapide et promesses en cours nettoyés.');
  }

  static async getStats(): Promise<{ count: number, totalSize: number, oldestFile: number }> {
    const count = this.cache.size;
    let oldestTimestamp = Infinity;
    
    this.cache.forEach(item => {
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
      }
    });

    return {
      count,
      totalSize: 0, // La taille n'est pas suivie pour ce cache d'URLs
      oldestFile: oldestTimestamp === Infinity ? 0 : oldestTimestamp,
    };
  }
}

// Nettoyage automatique avant fermeture
window.addEventListener('beforeunload', () => {
  UltraFastCache.cleanup();
});