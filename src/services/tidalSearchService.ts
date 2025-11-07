/**
 * Service de recherche Tidal pour convertir titre + artiste → Tidal ID
 * Utilise une liste dynamique d'instances pour des recherches simultanées.
 */

interface TidalSearchResult {
  id: string;
  title: string;
  artists: string[];
  album?: string;
  duration?: number;
}

class TidalSearchService {
  private cache = new Map<string, string>(); // Clé: "titre|artiste" → Tidal ID
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private searchInstances: string[] = [];
  private instancesPromise: Promise<void> | null = null;

  private loadInstances(): Promise<void> {
    if (this.instancesPromise) {
      return this.instancesPromise;
    }

    this.instancesPromise = (async () => {
      try {
        const response = await fetch('/instances.json');
        if (!response.ok) {
          throw new Error(`Failed to load instances.json: ${response.statusText}`);
        }
        const instances = await response.json();
        if (Array.isArray(instances) && instances.every(i => typeof i === 'string')) {
          this.searchInstances = instances;
          console.log(`✅ ${this.searchInstances.length} instances de recherche Tidal chargées.`);
        } else {
          throw new Error('Invalid format for instances.json');
        }
      } catch (error) {
        console.error("⚠️ Erreur chargement instances.json, utilisation de la liste par défaut:", error);
        // Fallback list in case the JSON file is unavailable
        this.searchInstances = [
          'https://aether.squid.wtf',
          'https://zeus.squid.wtf',
          'https://kraken.squid.wtf',
          'https://wolf.qqdl.site',
          'https://maus.qqdl.site',
          'https://vogel.qqdl.site',
          'https://katze.qqdl.site',
          'https://hund.qqdl.site',
          'https://phoenix.squid.wtf',
          'https://shiva.squid.wtf',
          'https://chaos.squid.wtf',
          'https://tidal.kinoplus.online'
        ];
      }
    })();
    
    return this.instancesPromise;
  }

  /**
   * Chercher l'ID Tidal d'un track via titre + artiste en parallèle sur toutes les instances.
   */
  async searchTidalId(title: string, artist: string): Promise<string | null> {
    await this.loadInstances();

    const cacheKey = `${title.toLowerCase()}|${artist.toLowerCase()}`;
    
    if (this.cache.has(cacheKey)) {
      console.log("🎯 Tidal ID en cache:", title, artist);
      return this.cache.get(cacheKey)!;
    }

    if (this.searchInstances.length === 0) {
      console.error("❌ Aucune instance de recherche Tidal disponible.");
      return null;
    }

    console.log(`🚀 Recherche simultanée sur ${this.searchInstances.length} instances pour:`, title, artist);

    const promises = this.searchInstances.map(instance => 
      (async () => {
        try {
          const searchQuery = `${title} ${artist}`;
          const url = `${instance}/search?s=${encodeURIComponent(searchQuery)}&limit=5`;
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
          });
          
          clearTimeout(timeout);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();
          const bestMatch = this.findBestMatch(data, title, artist);
          
          if (bestMatch) {
            console.log(`✅ Tidal ID trouvé: ${bestMatch} (${instance})`);
            return bestMatch;
          }
          
          throw new Error(`Aucun résultat pour "${title}" - "${artist}"`);
        } catch (error) {
          // This error is expected when an instance fails, so we don't log it to avoid noise.
          // Promise.any will handle it.
          throw new Error(`Échec sur ${instance}`);
        }
      })()
    );

    try {
      const firstResult = await Promise.any(promises);
      
      if (firstResult) {
        this.cache.set(cacheKey, firstResult);
        setTimeout(() => this.cache.delete(cacheKey), this.CACHE_TTL);
        return firstResult;
      }
    } catch (error) {
      // This error is thrown by Promise.any when all promises reject.
      // It's an AggregateError, but we don't need to log the details.
    }
    
    console.error("❌ Aucune instance n'a trouvé l'ID Tidal pour:", title, artist);
    return null;
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
   * Nettoyer le cache manuellement
   */
  clearCache(): void {
    this.cache.clear();
    console.log("🧹 Cache Tidal nettoyé");
  }

  /**
   * Obtenir les statistiques du cache
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        tidalId: value
      }))
    };
  }
}

// Instance singleton
export const tidalSearchService = new TidalSearchService();