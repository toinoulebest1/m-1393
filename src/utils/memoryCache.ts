
import { isInCache, getFromCache, addToCache } from './audioCache';

export class MemoryCache {
  private cache = new Map<string, string>();
  private maxSize: number;
  private currentSize = 0;
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  private evictLRU() {
    if (this.cache.size <= this.maxSize) return;

    let oldestKey = '';
    let oldestAccess = Infinity;

    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.currentSize--;
      console.log(`🗑️ Éviction LRU: ${oldestKey}`);
    }
  }

  set(key: string, value: string): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.accessOrder.set(key, ++this.accessCounter);
      return;
    }

    this.evictLRU();
    this.cache.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
    this.currentSize++;
  }

  get(key: string): string | null {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.accessOrder.set(key, ++this.accessCounter);
      return value;
    }
    return null;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder.delete(key);
      this.currentSize--;
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.currentSize = 0;
  }

  size(): number {
    return this.currentSize;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  getStats() {
    return {
      size: this.currentSize,
      maxSize: this.maxSize,
      utilization: (this.currentSize / this.maxSize * 100).toFixed(1) + '%'
    };
  }
}

export const memoryCache = new MemoryCache(100);

// Smart cache avec préchargement automatique
export class SmartCache {
  private static instance: SmartCache;
  private preloadQueue = new Set<string>();
  private preloadingPromises = new Map<string, Promise<void>>();

  static getInstance(): SmartCache {
    if (!SmartCache.instance) {
      SmartCache.instance = new SmartCache();
    }
    return SmartCache.instance;
  }

  async smartGet(key: string): Promise<string | null> {
    // 1. Vérifier le cache mémoire d'abord
    const memoryResult = memoryCache.get(key);
    if (memoryResult) {
      console.log("⚡ Cache mémoire hit:", key);
      return memoryResult;
    }

    // 2. Vérifier le cache IndexedDB
    try {
      if (await isInCache(key)) {
        const cachedUrl = await getFromCache(key);
        if (cachedUrl && typeof cachedUrl === 'string') {
          console.log("💾 Cache IndexedDB hit:", key);
          // Ajouter au cache mémoire pour la prochaine fois
          memoryCache.set(key, cachedUrl);
          return cachedUrl;
        }
      }
    } catch (error) {
      console.warn("⚠️ Erreur cache IndexedDB:", error);
    }

    // 3. Récupération réseau en dernier recours
    try {
      console.log("📡 Récupération réseau:", key);
      const { getAudioFileUrl } = await import('./storage');
      const audioUrl = await getAudioFileUrl(key);
      
      if (typeof audioUrl === 'string') {
        // Mettre en cache immédiatement
        memoryCache.set(key, audioUrl);
        
        // Cache IndexedDB en arrière-plan
        setTimeout(async () => {
          try {
            const response = await fetch(audioUrl);
            if (response.ok) {
              const blob = await response.blob();
              await addToCache(key, blob);
            }
          } catch (error) {
            console.warn("⚠️ Cache IndexedDB différé échoué:", error);
          }
        }, 100);
        
        return audioUrl;
      }
    } catch (error) {
      console.error("❌ Erreur récupération réseau:", error);
    }

    return null;
  }

  // Préchargement intelligent avec priorité
  async smartPreload(keys: string[], priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const delay = priority === 'high' ? 0 : priority === 'medium' ? 50 : 200;
    
    const preloadPromises = keys.map(async (key, index) => {
      if (this.preloadQueue.has(key) || memoryCache.has(key)) {
        return;
      }
      
      this.preloadQueue.add(key);
      
      // Délai échelonné pour éviter la surcharge
      await new Promise(resolve => setTimeout(resolve, index * delay));
      
      try {
        await this.smartGet(key);
        console.log(`✅ Préchargement réussi (${priority}):`, key);
      } catch (error) {
        console.warn(`⚠️ Préchargement échoué (${priority}):`, key, error);
      } finally {
        this.preloadQueue.delete(key);
      }
    });
    
    await Promise.allSettled(preloadPromises);
  }

  getStats() {
    return {
      memory: memoryCache.getStats(),
      preloadQueue: this.preloadQueue.size,
      activePreloads: this.preloadingPromises.size
    };
  }
}

export const smartCache = SmartCache.getInstance();
