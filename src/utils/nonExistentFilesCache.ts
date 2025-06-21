
/**
 * Cache persistant pour les fichiers inexistants
 * Évite les tentatives répétées et les logs d'erreur
 */

class NonExistentFilesCache {
  private static instance: NonExistentFilesCache;
  private cache = new Set<string>();
  private readonly STORAGE_KEY = 'nonExistentFiles';
  private readonly MAX_CACHE_SIZE = 1000;

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): NonExistentFilesCache {
    if (!NonExistentFilesCache.instance) {
      NonExistentFilesCache.instance = new NonExistentFilesCache();
    }
    return NonExistentFilesCache.instance;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const files = JSON.parse(stored);
        this.cache = new Set(files);
      }
    } catch (error) {
      // Ignore les erreurs de parsing
      this.cache = new Set();
    }
  }

  private saveToStorage(): void {
    try {
      const files = Array.from(this.cache);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(files));
    } catch (error) {
      // Ignore les erreurs de sauvegarde
    }
  }

  /**
   * Vérifie si un fichier est marqué comme inexistant
   */
  isNonExistent(fileId: string): boolean {
    return this.cache.has(fileId);
  }

  /**
   * Marque un fichier comme inexistant
   */
  markAsNonExistent(fileId: string): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Supprimer quelques anciens éléments
      const toRemove = Array.from(this.cache).slice(0, 100);
      toRemove.forEach(file => this.cache.delete(file));
    }
    
    this.cache.add(fileId);
    this.saveToStorage();
  }

  /**
   * Retire un fichier du cache (si il existe finalement)
   */
  remove(fileId: string): void {
    if (this.cache.delete(fileId)) {
      this.saveToStorage();
    }
  }

  /**
   * Nettoie le cache
   */
  clear(): void {
    this.cache.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Statistiques
   */
  getStats() {
    return {
      size: this.cache.size,
      files: Array.from(this.cache)
    };
  }
}

export const nonExistentFilesCache = NonExistentFilesCache.getInstance();
