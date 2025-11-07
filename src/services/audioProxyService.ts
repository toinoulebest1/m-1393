import { supabase } from '@/integrations/supabase/client';

interface ProxyInstance {
  url: string;
  name: string;
  score: number;
  lastUsed: number;
  errorCount: number;
  lastError: number;
}

interface CachedUrl {
  url: string;
  duration?: string;
  timestamp: number;
}

interface TidalSearchResult {
  id: string;
  title: string;
  artists: string[];
  album?: string;
  duration?: number;
}

class AudioProxyService {
  private instances: ProxyInstance[] = [];
  private urlCache = new Map<string, CachedUrl>();
  private readonly URL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  private readonly ERROR_COOLDOWN = 30000; // 30 secondes
  private initialized = false;

  /**
   * Initialiser le service avec test de latence des instances
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const response = await fetch('/instances.json');
      if (!response.ok) throw new Error('Failed to load instances');
      const data = await response.json();
      
      this.instances = data.map((url: string) => ({
        url,
        name: new URL(url).hostname,
        score: 100,
        lastUsed: 0,
        errorCount: 0,
        lastError: 0
      }));
      
      console.log(`✅ ${this.instances.length} instances de proxy audio chargées`);
      this.initialized = true;
    } catch (error) {
      console.error('❌ Erreur chargement instances:', error);
      this.instances = [];
    }
  }

  /**
   * Récupérer l'URL audio pour une chanson via le système de proxy en deux étapes
   */
  async getAudioUrl(
    trackId: string,
    title: string,
    artist: string,
    quality: 'LOW' | 'HIGH' | 'LOSSLESS' = 'HIGH'
  ): Promise<{ url: string; duration?: string } | null> {
    await this.initialize();

    if (this.instances.length === 0) {
      console.error("❌ Aucune instance de proxy disponible");
      return null;
    }

    // Vérifier le cache
    const cacheKey = `${trackId}_${quality}`;
    const cached = this.urlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.URL_CACHE_TTL) {
      console.log("🎯 Cache hit:", trackId);
      return { url: cached.url, duration: cached.duration };
    }

    console.log(`🚀 Début de la recherche en deux étapes pour: ${title} - ${artist}`);

    try {
      // ÉTAPE 1: Course pour trouver l'ID Tidal
      const tidalId = await this.raceForTidalId(title, artist);
      if (!tidalId) {
        console.error("❌ Aucune instance n'a trouvé l'ID Tidal");
        return null;
      }

      console.log(`✅ ID Tidal trouvé: ${tidalId}`);

      // ÉTAPE 2: Course pour récupérer l'URL audio avec l'ID trouvé
      const audioResult = await this.raceForAudioUrl(tidalId, quality);
      if (!audioResult) {
        console.error("❌ Aucune instance n'a pu récupérer l'URL audio");
        return null;
      }

      console.log(`✅ URL audio trouvée: ${audioResult.url.substring(0, 50)}...`);
      
      // Mettre en cache le résultat
      this.cacheUrl(cacheKey, audioResult.url, quality, audioResult.duration);
      
      return audioResult;
    } catch (error) {
      console.error("❌ Erreur lors de la recherche audio:", error);
      return null;
    }
  }

  /**
   * ÉTAPE 1: Course entre toutes les instances pour trouver l'ID Tidal
   */
  private async raceForTidalId(title: string, artist: string): Promise<string | null> {
    const controllers = this.instances.map(() => new AbortController());
    
    const searchPromises = this.instances.map((instance, index) => 
      this.searchTidalId(instance, title, artist, controllers[index].signal)
        .then(tidalId => {
          if (tidalId) {
            // Annuler toutes les autres recherches d'ID
            controllers.forEach((controller, i) => {
              if (i !== index) controller.abort();
            });
            console.log(`🏆 ID trouvé par ${instance.name}: ${tidalId}`);
            return tidalId;
          }
          throw new Error(`Aucun ID trouvé sur ${instance.name}`);
        })
    );

    try {
      return await Promise.any(searchPromises);
    } catch (error) {
      console.error("❌ Toutes les instances ont échoué à trouver l'ID Tidal");
      return null;
    }
  }

  /**
   * ÉTAPE 2: Course entre toutes les instances pour récupérer l'URL audio
   */
  private async raceForAudioUrl(tidalId: string, quality: string): Promise<{ url: string; duration?: string } | null> {
    const controllers = this.instances.map(() => new AbortController());
    
    const urlPromises = this.instances.map((instance, index) => 
      this.fetchAudioUrl(instance, tidalId, quality, controllers[index].signal)
        .then(result => {
          if (result) {
            // Annuler toutes les autres requêtes d'URL
            controllers.forEach((controller, i) => {
              if (i !== index) controller.abort();
            });
            console.log(`🏆 URL trouvée par ${instance.name}`);
            return result;
          }
          throw new Error(`Aucune URL trouvée sur ${instance.name}`);
        })
    );

    try {
      return await Promise.any(urlPromises);
    } catch (error) {
      console.error("❌ Toutes les instances ont échoué à récupérer l'URL audio");
      return null;
    }
  }

  /**
   * Rechercher l'ID Tidal sur une instance spécifique
   */
  private async searchTidalId(instance: ProxyInstance, title: string, artist: string, signal: AbortSignal): Promise<string | null> {
    try {
      const searchQuery = `${title} ${artist}`;
      const url = `${instance.url}/search?s=${encodeURIComponent(searchQuery)}&limit=5`;
      
      const response = await fetch(url, {
        signal,
        headers: { 
          'Accept': 'application/json',
          'Origin': window.location.origin
        }
      });
      
      if (!response) {
        throw new Error('Pas de réponse du serveur');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const bestMatch = this.findBestMatch(data, title, artist);
      
      return bestMatch;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`⏹️ Recherche annulée sur ${instance.name}`);
      } else if (error instanceof Error && error.message.includes('CORS')) {
        console.warn(`⚠️ Erreur CORS sur ${instance.name}:`, error.message);
      } else {
        console.warn(`⚠️ Erreur recherche ID sur ${instance.name}:`, error);
      }
      return null;
    }
  }

  /**
   * Récupérer l'URL audio sur une instance spécifique
   */
  private async fetchAudioUrl(instance: ProxyInstance, tidalId: string, quality: string, signal: AbortSignal): Promise<{ url: string; duration?: string } | null> {
    try {
      const url = `${instance.url}/download?id=${tidalId}&quality=${quality}`;
      
      const response = await fetch(url, {
        signal,
        headers: { 
          'Accept': 'application/json',
          'Origin': window.location.origin
        }
      });
      
      if (!response) {
        throw new Error('Pas de réponse du serveur');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.url) {
        return {
          url: data.url,
          duration: data.duration
        };
      }
      
      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`⏹️ Requête URL annulée sur ${instance.name}`);
      } else if (error instanceof Error && error.message.includes('CORS')) {
        console.warn(`⚠️ Erreur CORS sur ${instance.name}:`, error.message);
      } else {
        console.warn(`⚠️ Erreur récupération URL sur ${instance.name}:`, error);
      }
      return null;
    }
  }

  /**
   * Trouver le meilleur match dans les résultats de recherche
   */
  private findBestMatch(data: any, searchTitle: string, searchArtist: string): string | null {
    if (!data || !data.items || !Array.isArray(data.items)) {
      return null;
    }
    
    const normalizeString = (str: string) => 
      str.toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ');
    
    const normalizedSearchTitle = normalizeString(searchTitle);
    const normalizedSearchArtist = normalizeString(searchArtist);
    
    for (const track of data.items) {
      if (!track.id) continue;
      
      const trackTitle = normalizeString(track.title || '');
      const trackArtists = (track.artists || [])
        .map((a: any) => normalizeString(typeof a === 'string' ? a : a.name || ''))
        .join(' ');
      
      if (trackTitle === normalizedSearchTitle && 
          trackArtists.includes(normalizedSearchArtist)) {
        return String(track.id);
      }
    }
    
    for (const track of data.items) {
      if (!track.id) continue;
      
      const trackTitle = normalizeString(track.title || '');
      const trackArtists = (track.artists || [])
        .map((a: any) => normalizeString(typeof a === 'string' ? a : a.name || ''))
        .join(' ');
      
      if ((trackTitle.includes(normalizedSearchTitle) || 
           normalizedSearchTitle.includes(trackTitle)) &&
          trackArtists.includes(normalizedSearchArtist)) {
        return String(track.id);
      }
    }
    
    return null;
  }

  /**
   * Mettre en cache une URL
   */
  private cacheUrl(key: string, url: string, quality: string, duration?: string): void {
    if (this.urlCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.urlCache.keys().next().value;
      this.urlCache.delete(firstKey);
    }
    
    this.urlCache.set(key, {
      url,
      duration,
      timestamp: Date.now()
    });
  }

  /**
   * Nettoyer le cache
   */
  clearCache(): void {
    this.urlCache.clear();
    console.log("🧹 Cache audio nettoyé");
  }

  /**
   * Obtenir les statistiques du cache
   */
  getCacheStats() {
    return {
      size: this.urlCache.size,
      entries: Array.from(this.urlCache.entries()).map(([key, value]) => ({
        key,
        url: value.url.substring(0, 50) + '...',
        timestamp: new Date(value.timestamp).toISOString()
      }))
    };
  }
}

// Instance singleton
export const audioProxyService = new AudioProxyService();