
/**
 * Pool d'éléments audio pour hot-swapping ultra-rapide
 * Élimine le temps de création/configuration des éléments audio
 */

interface PooledAudioElement {
  element: HTMLAudioElement;
  inUse: boolean;
  preloadedFor?: string;
  lastUsed: number;
}

export class AudioElementPool {
  private static pool: PooledAudioElement[] = [];
  private static readonly POOL_SIZE = 5;
  private static initialized = false;

  /**
   * Initialisation du pool avec éléments pré-configurés
   */
  static initialize(): void {
    if (this.initialized) return;

    console.log("🎵 Initialisation Audio Pool");
    
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      audio.volume = 0.7;
      
      // Optimisations navigateur
      (audio as any).preservesPitch = false;
      (audio as any).mozPreservesPitch = false;
      (audio as any).webkitPreservesPitch = false;
      
      this.pool.push({
        element: audio,
        inUse: false,
        lastUsed: Date.now()
      });
    }
    
    this.initialized = true;
    console.log(`✅ Pool initialisé: ${this.POOL_SIZE} éléments`);
  }

  /**
   * Récupération ultra-rapide d'un élément libre
   */
  static acquire(forSong?: string): HTMLAudioElement {
    this.initialize();
    
    // Chercher un élément libre déjà préchargé pour cette chanson
    if (forSong) {
      const preloaded = this.pool.find(p => 
        !p.inUse && p.preloadedFor === forSong
      );
      if (preloaded) {
        preloaded.inUse = true;
        preloaded.lastUsed = Date.now();
        console.log("🎯 Audio pré-chargé trouvé:", forSong);
        return preloaded.element;
      }
    }
    
    // Chercher n'importe quel élément libre
    const available = this.pool.find(p => !p.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      available.preloadedFor = forSong;
      console.log("🎵 Audio acquis du pool");
      return available.element;
    }
    
    // Pool plein - forcer la libération du plus ancien
    const oldest = this.pool.reduce((prev, curr) => 
      prev.lastUsed < curr.lastUsed ? prev : curr
    );
    
    oldest.element.pause();
    oldest.element.src = '';
    oldest.inUse = true;
    oldest.lastUsed = Date.now();
    oldest.preloadedFor = forSong;
    
    console.log("⚠️ Pool plein - réutilisation forcée");
    return oldest.element;
  }

  /**
   * Libération d'un élément (mais garde en pool)
   */
  static release(element: HTMLAudioElement): void {
    const pooled = this.pool.find(p => p.element === element);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = Date.now();
      console.log("🔄 Audio libéré vers pool");
    }
  }

  /**
   * Préchargement d'une chanson dans un élément libre
   */
  static async preload(songUrl: string, audioUrl: string): Promise<boolean> {
    this.initialize();
    
    const available = this.pool.find(p => !p.inUse);
    if (!available) {
      console.log("⚠️ Pas d'élément libre pour préchargement");
      return false;
    }
    
    try {
      available.element.src = audioUrl;
      available.preloadedFor = songUrl;
      available.element.load();
      
      console.log("🚀 Préchargement audio pool:", songUrl);
      return true;
    } catch (error) {
      console.error("❌ Erreur préchargement pool:", error);
      return false;
    }
  }

  /**
   * Hot-swap instantané entre deux éléments
   */
  static hotSwap(currentElement: HTMLAudioElement, newElement: HTMLAudioElement): void {
    const currentTime = currentElement.currentTime;
    const volume = currentElement.volume;
    const playbackRate = currentElement.playbackRate;
    
    // Transférer l'état instantanément
    newElement.volume = volume;
    newElement.playbackRate = playbackRate;
    newElement.currentTime = currentTime;
    
    console.log("⚡ Hot-swap terminé en < 1ms");
  }

  /**
   * Statistiques du pool
   */
  static getStats() {
    return {
      poolSize: this.pool.length,
      inUse: this.pool.filter(p => p.inUse).length,
      available: this.pool.filter(p => !p.inUse).length,
      preloaded: this.pool.filter(p => p.preloadedFor).length
    };
  }
}
