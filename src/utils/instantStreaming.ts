
/**
 * Streaming instantané - Optimisé pour un démarrage ultra-rapide
 */

import { UltraFastCache } from './ultraFastCache';
import { memoryCache } from './memoryCache';
import { getAudioFileUrl } from './storage';
import { nonExistentFilesCache } from './nonExistentFilesCache';

export class InstantStreaming {
  private static parallelFetches = new Map<string, Promise<string>>();
  private static prefetchQueue = new Set<string>();
  
  /**
   * Récupération instantanée avec fetch parallèle optimisé
   */
  static async getInstantAudioUrl(songUrl: string): Promise<string> {
    const startTime = performance.now();
    
    // Vérifier d'abord le cache des fichiers inexistants
    if (nonExistentFilesCache.isNonExistent(songUrl)) {
      throw new Error(`File marked as non-existent: ${songUrl}`);
    }
    
    // 1. Cache L0 ultra-rapide (< 0.1ms)
    const l0Result = UltraFastCache.getL0(songUrl);
    if (l0Result) {
      return l0Result;
    }

    // 2. Cache mémoire (< 1ms)
    const memResult = memoryCache.get(songUrl);
    if (memResult) {
      // Promouvoir vers L0 en arrière-plan
      this.promoteToL0Async(songUrl, memResult);
      return memResult;
    }

    // 3. Fetch parallèle si déjà en cours
    if (this.parallelFetches.has(songUrl)) {
      return this.parallelFetches.get(songUrl)!;
    }

    // 4. Nouveau fetch ultra-optimisé
    const fetchPromise = this.ultraFastFetch(songUrl, startTime);
    this.parallelFetches.set(songUrl, fetchPromise);

    try {
      const result = await fetchPromise;
      this.parallelFetches.delete(songUrl);
      return result;
    } catch (error) {
      this.parallelFetches.delete(songUrl);
      throw error;
    }
  }

  /**
   * Fetch ultra-optimisé avec timeout court
   */
  private static async ultraFastFetch(songUrl: string, startTime: number): Promise<string> {
    try {
      // Timeout agressif de 3 secondes max
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
      
      const fetchPromise = getAudioFileUrl(songUrl);
      
      const audioUrl = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!audioUrl || typeof audioUrl !== 'string') {
        throw new Error('URL invalide');
      }
      
      // Mise en cache immédiate
      memoryCache.set(songUrl, audioUrl);
      
      // Promotion L0 en arrière-plan
      setTimeout(() => this.promoteToL0Async(songUrl, audioUrl), 0);
      
      return audioUrl;
      
    } catch (error) {
      throw new Error(`Impossible de charger: ${songUrl}`);
    }
  }

  /**
   * Promotion L0 asynchrone
   */
  private static async promoteToL0Async(songUrl: string, audioUrl: string): Promise<void> {
    try {
      const response = await fetch(audioUrl, { 
        method: 'HEAD' // Juste pour vérifier l'URL
      });
      
      if (response.ok) {
        // Télécharger le blob complet en arrière-plan
        setTimeout(async () => {
          try {
            const fullResponse = await fetch(audioUrl);
            if (fullResponse.ok) {
              const blob = await fullResponse.blob();
              UltraFastCache.setL0(songUrl, audioUrl, blob);
            }
          } catch (error) {
            // Ignorer silencieusement
          }
        }, 100);
      }
    } catch (error) {
      // Ignorer silencieusement
    }
  }

  /**
   * Préchargement ultra-conservateur
   */
  static async prefetchNext(songUrls: string[]): Promise<void> {
    if (songUrls.length === 0) return;
    
    // Seulement la première chanson
    const url = songUrls[0];
    
    // Éviter les doublons et fichiers inexistants
    if (this.prefetchQueue.has(url) || nonExistentFilesCache.isNonExistent(url)) {
      return;
    }
    
    this.prefetchQueue.add(url);
    
    try {
      // Vérifier si déjà en cache
      if (memoryCache.has(url) || UltraFastCache.hasL0(url)) {
        return;
      }
      
      // Précharger silencieusement
      await this.getInstantAudioUrl(url);
      
    } catch (error) {
      // Ignorer silencieusement
    } finally {
      this.prefetchQueue.delete(url);
    }
  }

  /**
   * Nettoyage des ressources
   */
  static cleanup(): void {
    this.parallelFetches.clear();
    this.prefetchQueue.clear();
  }

  /**
   * Statistiques
   */
  static getStats() {
    return {
      activeFetches: this.parallelFetches.size,
      prefetchQueue: this.prefetchQueue.size,
      l0Cache: UltraFastCache.getStats(),
      memoryCache: memoryCache.getStats()
    };
  }
}

// Nettoyage automatique
window.addEventListener('beforeunload', () => {
  InstantStreaming.cleanup();
});
