
/**
 * Streaming instantané - Optimisé pour un démarrage ultra-rapide
 */

import { UltraFastCache } from './ultraFastCache';
import { memoryCache } from './memoryCache';
import { getAudioFileUrl } from './storage';

// Cache des fichiers inexistants pour éviter les tentatives répétées
const notFoundCache = new Set<string>();

export class InstantStreaming {
  private static parallelFetches = new Map<string, Promise<string>>();
  private static prefetchQueue = new Set<string>();
  
  /**
   * Récupération instantanée avec gestion optimisée des erreurs
   */
  static async getInstantAudioUrl(songUrl: string): Promise<string> {
    const startTime = performance.now();
    console.log("⚡ === STREAMING INSTANTANÉ ===");
    
    // Vérifier d'abord si le fichier est connu comme inexistant
    if (notFoundCache.has(songUrl)) {
      console.log("🚫 Fichier connu comme inexistant, ignoré:", songUrl);
      throw new Error(`Fichier inexistant: ${songUrl}`);
    }
    
    // 1. Cache L0 ultra-rapide (< 0.1ms)
    const l0Result = UltraFastCache.getL0(songUrl);
    if (l0Result) {
      console.log("⚡ L0:", (performance.now() - startTime).toFixed(1), "ms");
      return l0Result;
    }

    // 2. Cache mémoire (< 1ms)
    const memResult = memoryCache.get(songUrl);
    if (memResult) {
      console.log("💾 Memory:", (performance.now() - startTime).toFixed(1), "ms");
      // Promouvoir vers L0 en arrière-plan
      this.promoteToL0Async(songUrl, memResult);
      return memResult;
    }

    // 3. Fetch parallèle si déjà en cours
    if (this.parallelFetches.has(songUrl)) {
      console.log("🔄 Réutilisation fetch existant");
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
      
      // Ajouter au cache des fichiers inexistants si c'est une erreur de fichier non trouvé
      if (error instanceof Error && (
        error.message.includes('not found') || 
        error.message.includes('introuvable') ||
        error.message.includes('File may not exist')
      )) {
        notFoundCache.add(songUrl);
        console.log("🚫 Fichier ajouté au cache des inexistants:", songUrl);
      }
      
      throw error;
    }
  }

  /**
   * Fetch ultra-optimisé avec timeout court et gestion d'erreur améliorée
   */
  private static async ultraFastFetch(songUrl: string, startTime: number): Promise<string> {
    console.log("🚀 Ultra-fast fetch:", songUrl);
    
    try {
      // Timeout encore plus agressif de 2 secondes max
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ultra-rapide')), 2000);
      });
      
      const fetchPromise = getAudioFileUrl(songUrl);
      
      const audioUrl = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!audioUrl || typeof audioUrl !== 'string') {
        throw new Error('URL invalide');
      }
      
      const elapsed = performance.now() - startTime;
      console.log("✅ Fetch réussi:", elapsed.toFixed(1), "ms");
      
      // Mise en cache immédiate
      memoryCache.set(songUrl, audioUrl);
      
      // Promotion L0 en arrière-plan (plus rapide)
      setTimeout(() => this.promoteToL0Async(songUrl, audioUrl), 0);
      
      return audioUrl;
      
    } catch (error) {
      const elapsed = performance.now() - startTime;
      console.warn("⚠️ Fetch échoué rapidement:", elapsed.toFixed(1), "ms", songUrl);
      throw new Error(`Impossible de charger: ${songUrl}`);
    }
  }

  /**
   * Promotion L0 asynchrone optimisée
   */
  private static async promoteToL0Async(songUrl: string, audioUrl: string): Promise<void> {
    try {
      // Vérification plus rapide avec HEAD
      const response = await fetch(audioUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(1000) // 1 seconde max
      });
      
      if (response.ok) {
        // Télécharger le blob complet en arrière-plan
        setTimeout(async () => {
          try {
            const fullResponse = await fetch(audioUrl, {
              signal: AbortSignal.timeout(5000) // 5 secondes max pour le téléchargement
            });
            if (fullResponse.ok) {
              const blob = await fullResponse.blob();
              UltraFastCache.setL0(songUrl, audioUrl, blob);
              console.log("💾 L0 promotion:", songUrl);
            }
          } catch (error) {
            console.warn("⚠️ L0 promotion échouée:", error);
          }
        }, 50); // Réduction du délai
      }
    } catch (error) {
      console.warn("⚠️ L0 check échoué:", error);
    }
  }

  /**
   * Préchargement intelligent avec filtrage des fichiers inexistants
   */
  static async prefetchNext(songUrls: string[]): Promise<void> {
    if (songUrls.length === 0) return;
    
    // Filtrer les fichiers connus comme inexistants
    const validUrls = songUrls.filter(url => !notFoundCache.has(url));
    
    if (validUrls.length === 0) {
      console.log("🚫 Tous les fichiers sont connus comme inexistants");
      return;
    }
    
    console.log("🎯 Préchargement intelligent:", validUrls.length, "fichiers valides");
    
    // Traiter les URLs par priorité décroissante avec limite de concurrence
    const maxConcurrent = 3; // Limiter la concurrence pour éviter la surcharge
    
    for (let i = 0; i < validUrls.length; i += maxConcurrent) {
      const batch = validUrls.slice(i, i + maxConcurrent);
      
      const promises = batch.map(async (url, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        // Éviter les doublons
        if (this.prefetchQueue.has(url)) return;
        this.prefetchQueue.add(url);
        
        try {
          // Délai échelonné réduit: 0ms, 20ms, 40ms, etc.
          const delay = globalIndex * 20;
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Vérifier si déjà en cache
          if (memoryCache.has(url) || UltraFastCache.hasL0(url)) {
            return;
          }
          
          // Précharger avec timeout plus court
          await Promise.race([
            this.getInstantAudioUrl(url),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Préchargement timeout')), 1500)
            )
          ]);
          
          console.log("✅ Préchargé:", url);
          
        } catch (error) {
          console.warn("⚠️ Préchargement échoué:", url);
          // Ne pas loguer l'erreur complète pour éviter le spam
        } finally {
          this.prefetchQueue.delete(url);
        }
      });
      
      // Attendre que ce batch soit terminé avant de passer au suivant
      await Promise.allSettled(promises);
      
      // Petit délai entre les batches pour éviter la surcharge
      if (i + maxConcurrent < validUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Nettoyage des ressources avec nettoyage du cache des inexistants
   */
  static cleanup(): void {
    this.parallelFetches.clear();
    this.prefetchQueue.clear();
    notFoundCache.clear();
    console.log("🧹 InstantStreaming nettoyé");
  }

  /**
   * Supprimer un fichier du cache des inexistants (si re-uploadé par exemple)
   */
  static clearNotFoundCache(songUrl?: string): void {
    if (songUrl) {
      notFoundCache.delete(songUrl);
      console.log("🔄 Fichier retiré du cache des inexistants:", songUrl);
    } else {
      notFoundCache.clear();
      console.log("🔄 Cache des inexistants vidé complètement");
    }
  }

  /**
   * Statistiques améliorées
   */
  static getStats() {
    return {
      activeFetches: this.parallelFetches.size,
      prefetchQueue: this.prefetchQueue.size,
      notFoundCache: notFoundCache.size,
      l0Cache: UltraFastCache.getStats(),
      memoryCache: memoryCache.getStats()
    };
  }
}

// Nettoyage automatique
window.addEventListener('beforeunload', () => {
  InstantStreaming.cleanup();
});
