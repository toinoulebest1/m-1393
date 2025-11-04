import { Song } from '@/types/player';
import { getAudioFileUrl } from './storage';

/**
 * Système de génération prédictive d'URLs audio
 * Génère les URLs en avance pour éviter les latences au moment de la lecture
 */
class PredictiveUrlGenerator {
  private urlCache: Map<string, { url: string; timestamp: number }> = new Map();
  private pendingPromises: Map<string, Promise<string>> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes en RAM

  /**
   * Pré-génère les URLs pour les prochaines chansons de la queue
   */
  async pregenerateUrls(queue: Song[], currentIndex: number): Promise<void> {
    const nextSongs = queue.slice(currentIndex + 1, currentIndex + 4); // 3 chansons suivantes
    
    console.log('🔮 Génération prédictive des URLs pour', nextSongs.length, 'chansons');

    // Générer toutes les URLs en parallèle
    const promises = nextSongs.map(song => this.getOrGenerateUrl(song));
    await Promise.allSettled(promises); // Ignorer les échecs individuels
  }

  /**
   * Obtient l'URL depuis le cache RAM ou la génère
   */
  async getOrGenerateUrl(song: Song): Promise<string> {
    const cacheKey = this.getCacheKey(song);

    // 1. Vérifier le cache RAM
    const cached = this.urlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('✅ URL trouvée en cache RAM pour', song.title);
      return cached.url;
    }

    // 2. Vérifier si une promesse est déjà en cours
    const existingPromise = this.pendingPromises.get(cacheKey);
    if (existingPromise) {
      console.log('⏳ Promesse en cours pour', song.title);
      return existingPromise;
    }

    // 3. Générer l'URL
    const promise = this.generateUrl(song, cacheKey);
    this.pendingPromises.set(cacheKey, promise);

    try {
      const url = await promise;
      this.pendingPromises.delete(cacheKey);
      return url;
    } catch (error) {
      this.pendingPromises.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Génère l'URL et la met en cache RAM
   */
  private async generateUrl(song: Song, cacheKey: string): Promise<string> {
    try {
      console.log('🎯 Génération prédictive de l\'URL pour', song.title);
      const url = await getAudioFileUrl(
        song.url,
        song.deezer_id,
        song.title,
        song.artist,
        song.id
      );

      // Mettre en cache RAM
      this.urlCache.set(cacheKey, {
        url,
        timestamp: Date.now()
      });

      // Nettoyage automatique du cache
      this.cleanupOldEntries();

      return url;
    } catch (error) {
      console.error('❌ Erreur génération URL prédictive:', error);
      throw error;
    }
  }

  /**
   * Nettoie les entrées expirées du cache RAM
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    for (const [key, value] of this.urlCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.urlCache.delete(key);
      }
    }
  }

  /**
   * Génère une clé de cache unique pour une chanson
   */
  private getCacheKey(song: Song): string {
    return `${song.id}-${song.deezer_id || 'no-deezer'}`;
  }

  /**
   * Vide complètement le cache RAM
   */
  clearCache(): void {
    this.urlCache.clear();
    this.pendingPromises.clear();
  }

  /**
   * Statistiques du système prédictif
   */
  getStats() {
    return {
      cachedUrls: this.urlCache.size,
      pendingPromises: this.pendingPromises.size,
      cacheEntries: Array.from(this.urlCache.entries()).map(([key, value]) => ({
        key,
        age: Date.now() - value.timestamp
      }))
    };
  }
}

export const predictiveUrlGenerator = new PredictiveUrlGenerator();
