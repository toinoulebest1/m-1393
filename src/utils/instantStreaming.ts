
/**
 * Streaming Ultra-Agressif - Zéro timeout, maximum vitesse
 */

import { UltraFastCache } from './ultraFastCache';
import { memoryCache } from './memoryCache';
import { isInCache, getFromCache } from './audioCache';
import { getAudioFileUrl } from './storage';

export class UltraFastStreaming {
  private static promisePool = new Map<string, Promise<string>>();
  private static activeRequests = new Set<string>();
  private static failedFiles = new Set<string>();
  private static retryCount = new Map<string, number>();

  /**
   * Récupération ultra-rapide avec cascade de caches
   */
  static async getAudioUrlUltraFast(songUrl: string): Promise<string> {
    const startTime = performance.now();
    console.log("🚀 === STREAMING ULTRA-RAPIDE ===");
    console.log("🎵 URL:", songUrl);

    // Si le fichier a déjà échoué plusieurs fois, ne pas réessayer
    if (this.failedFiles.has(songUrl)) {
      throw new Error(`Fichier définitivement indisponible: ${songUrl}`);
    }

    // 1. L0 Cache ultra-instantané (< 0.1ms)
    const l0Result = UltraFastCache.getL0(songUrl);
    if (l0Result) {
      const elapsed = performance.now() - startTime;
      console.log("⚡ L0 CACHE:", elapsed.toFixed(2), "ms");
      return l0Result;
    }

    // 2. Warm Cache (< 0.5ms)
    const warmResult = UltraFastCache.getWarm(songUrl);
    if (warmResult) {
      const elapsed = performance.now() - startTime;
      console.log("🔥 WARM CACHE:", elapsed.toFixed(2), "ms");
      return warmResult;
    }

    // 3. Cache mémoire (< 1ms)
    const memoryResult = memoryCache.get(songUrl);
    if (memoryResult) {
      const elapsed = performance.now() - startTime;
      console.log("💾 MEMORY CACHE:", elapsed.toFixed(2), "ms");
      // Promouvoir vers L0
      this.promoteToL0(songUrl, memoryResult);
      return memoryResult;
    }

    // 4. Vérifier si déjà en cours de récupération
    if (this.promisePool.has(songUrl)) {
      console.log("🔄 Réutilisation promesse existante");
      return this.promisePool.get(songUrl)!;
    }

    // 5. Streaming parallèle ultra-agressif
    const streamingPromise = this.ultraAggressiveStreaming(songUrl, startTime);
    this.promisePool.set(songUrl, streamingPromise);

    try {
      const result = await streamingPromise;
      this.promisePool.delete(songUrl);
      // Reset retry count on success
      this.retryCount.delete(songUrl);
      return result;
    } catch (error) {
      this.promisePool.delete(songUrl);
      
      // Gérer les tentatives
      const currentRetries = this.retryCount.get(songUrl) || 0;
      if (currentRetries >= 2) {
        console.warn(`🚫 Fichier marqué comme indisponible après ${currentRetries + 1} tentatives:`, songUrl);
        this.failedFiles.add(songUrl);
        this.retryCount.delete(songUrl);
      } else {
        this.retryCount.set(songUrl, currentRetries + 1);
      }
      
      throw error;
    }
  }

  /**
   * Streaming parallèle sans aucun timeout
   */
  private static async ultraAggressiveStreaming(songUrl: string, startTime: number): Promise<string> {
    console.log("📡 Streaming parallèle ultra-agressif");
    
    // Promises en parallèle total - pas de timeout du tout
    const promises = [
      // IndexedDB ultra-rapide
      this.tryIndexedDB(songUrl),
      // Réseau immédiat
      this.tryNetwork(songUrl)
    ];

    // Promise.race avec gestion des erreurs
    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const elapsed = performance.now() - startTime;
        console.log("✅ STREAMING RÉUSSI:", elapsed.toFixed(2), "ms");
        
        // Promouvoir vers tous les caches
        this.promoteToAllCaches(songUrl, result.value);
        
        return result.value;
      }
    }

    throw new Error("Tous les streams ont échoué");
  }

  /**
   * Tentative IndexedDB ultra-rapide
   */
  private static async tryIndexedDB(songUrl: string): Promise<string | null> {
    try {
      if (await isInCache(songUrl)) {
        const cachedUrl = await getFromCache(songUrl);
        if (cachedUrl && typeof cachedUrl === 'string') {
          console.log("💾 IndexedDB HIT");
          return cachedUrl;
        }
      }
    } catch (error) {
      console.warn("⚠️ IndexedDB failed");
    }
    return null;
  }

  /**
   * Tentative réseau ultra-rapide
   */
  private static async tryNetwork(songUrl: string): Promise<string | null> {
    try {
      const audioUrl = await getAudioFileUrl(songUrl);
      if (typeof audioUrl === 'string') {
        console.log("📡 NETWORK HIT");
        return audioUrl;
      }
    } catch (error) {
      console.warn("⚠️ Network failed");
    }
    return null;
  }

  /**
   * Promotion vers L0 cache
   */
  private static async promoteToL0(songUrl: string, audioUrl: string): Promise<void> {
    try {
      // Télécharger le blob en arrière-plan pour L0
      const response = await fetch(audioUrl);
      if (response.ok) {
        const blob = await response.blob();
        UltraFastCache.setL0(songUrl, audioUrl, blob);
      }
    } catch (error) {
      console.warn("⚠️ Promotion L0 échouée");
    }
  }

  /**
   * Promotion vers tous les caches
   */
  private static promoteToAllCaches(songUrl: string, audioUrl: string): void {
    // Warm cache immédiat
    UltraFastCache.setWarm(songUrl, audioUrl);
    
    // Memory cache immédiat
    memoryCache.set(songUrl, audioUrl);
    
    // L0 cache en arrière-plan
    setTimeout(() => this.promoteToL0(songUrl, audioUrl), 0);
  }

  /**
   * Préchargement ultra-agressif de batch avec gestion des erreurs
   */
  static async preloadBatch(songUrls: string[]): Promise<void> {
    console.log("🚀 Préchargement batch intelligent:", songUrls.length);
    
    // Filtrer les fichiers déjà marqués comme indisponibles
    const availableUrls = songUrls.filter(url => !this.failedFiles.has(url));
    
    if (availableUrls.length === 0) {
      console.log("⚡ Tous les fichiers sont indisponibles ou en cache");
      return;
    }
    
    console.log(`📋 Préchargement: ${availableUrls.length}/${songUrls.length} fichiers disponibles`);
    
    const promises = availableUrls.map(async (url, index) => {
      // Délai ultra-court échelonné pour éviter la surcharge
      await new Promise(resolve => setTimeout(resolve, index * 10)); // 10ms
      
      try {
        await this.getAudioUrlUltraFast(url);
        console.log("✅ Préchargé:", url);
      } catch (error) {
        console.warn("⚠️ Préchargement échoué (silencieux):", url);
        // Ne pas logger l'erreur complète pour éviter le spam
      }
    });
    
    await Promise.allSettled(promises);
    console.log("✅ Batch terminé");
  }

  /**
   * Vérifier si un fichier est disponible sans le télécharger
   */
  static isFileAvailable(songUrl: string): boolean {
    return !this.failedFiles.has(songUrl);
  }

  /**
   * Nettoyer la liste des fichiers échoués (réinitialiser périodiquement)
   */
  static clearFailedFiles(): void {
    console.log("🧹 Nettoyage des fichiers échoués:", this.failedFiles.size);
    this.failedFiles.clear();
    this.retryCount.clear();
  }

  /**
   * Statistiques du streaming
   */
  static getStats() {
    return {
      activePromises: this.promisePool.size,
      activeRequests: this.activeRequests.size,
      failedFiles: this.failedFiles.size,
      retryCount: this.retryCount.size,
      l0Stats: UltraFastCache.getStats()
    };
  }
}

// Nettoyer les fichiers échoués toutes les 10 minutes
setInterval(() => {
  UltraFastStreaming.clearFailedFiles();
}, 10 * 60 * 1000);
