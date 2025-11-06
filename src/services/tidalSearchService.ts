/**
 * Service de recherche Tidal pour convertir titre + artiste → Tidal ID
 * Utilise l'API aether.squid.wtf/search
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
  private readonly searchInstances = [
    'https://chaos.squid.wtf',
  ];

  /**
   * Chercher l'ID Tidal d'un track via titre + artiste
   */
  async searchTidalId(title: string, artist: string): Promise<string | null> {
    const cacheKey = `${title.toLowerCase()}|${artist.toLowerCase()}`;
    
    // Vérifier le cache
    if (this.cache.has(cacheKey)) {
      console.log("🎯 Tidal ID en cache:", title, artist);
      return this.cache.get(cacheKey)!;
    }

    // Essayer chaque instance jusqu'à trouver un résultat
    for (const instance of this.searchInstances) {
      try {
        console.log(`🔍 Recherche Tidal via ${instance}:`, title, artist);
        
        // Utiliser les paramètres s (song) et a (artist) au lieu de q
        const url = `${instance}/search?s=${encodeURIComponent(title)}&a=${encodeURIComponent(artist)}&limit=5`;
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          console.warn(`⚠️ ${instance} search HTTP ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        // Chercher le meilleur match
        const bestMatch = this.findBestMatch(data, title, artist);
        
        if (bestMatch) {
          console.log(`✅ Tidal ID trouvé: ${bestMatch} (${instance})`);
          
          // Mettre en cache
          this.cache.set(cacheKey, bestMatch);
          
          // Nettoyer le cache après TTL
          setTimeout(() => this.cache.delete(cacheKey), this.CACHE_TTL);
          
          return bestMatch;
        }
        
        console.warn(`⚠️ ${instance}: Aucun résultat pour "${title}" - "${artist}"`);
        
      } catch (error) {
        console.warn(`⚠️ ${instance} search échec:`, error);
        continue;
      }
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
    
    // Essayer de trouver un match exact
    for (const track of data.items) {
      if (!track.id) continue;
      
      const trackTitle = normalizeString(track.title || '');
      const trackArtists = (track.artists || [])
        .map((a: any) => normalizeString(typeof a === 'string' ? a : a.name || ''))
        .join(' ');
      
      // Match exact titre + artiste
      if (trackTitle === normalizedSearchTitle && 
          trackArtists.includes(normalizedSearchArtist)) {
        return String(track.id);
      }
    }
    
    // Essayer un match partiel sur le titre principal
    for (const track of data.items) {
      if (!track.id) continue;
      
      const trackTitle = normalizeString(track.title || '');
      const trackArtists = (track.artists || [])
        .map((a: any) => normalizeString(typeof a === 'string' ? a : a.name || ''))
        .join(' ');
      
      // Match partiel (titre contient recherche OU recherche contient titre)
      if ((trackTitle.includes(normalizedSearchTitle) || 
           normalizedSearchTitle.includes(trackTitle)) &&
          trackArtists.includes(normalizedSearchArtist)) {
        return String(track.id);
      }
    }
    
    // Si aucun match, retourner le premier résultat par défaut
    if (data.items.length > 0 && data.items[0].id) {
      console.warn("⚠️ Aucun match exact, utilisation du premier résultat");
      return String(data.items[0].id);
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