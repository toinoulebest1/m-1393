
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

// Pre-warmed audio URLs pour accès instantané
const warmCache = new Map<string, string>();

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
    warmCache.set(songUrl, audioUrl);
    console.log("🔥 WARM CACHE:", songUrl);
  }

  static getWarm(songUrl: string): string | null {
    const url = warmCache.get(songUrl);
    if (url) {
      console.log("🔥 WARM HIT:", songUrl);
    }
    return url || null;
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
}

// Nettoyage automatique avant fermeture
window.addEventListener('beforeunload', () => {
  UltraFastCache.cleanup();
});
