
/**
 * Système de cache pour les fichiers audio
 * Optimise les performances en évitant les téléchargements répétés
 */

// Utilise IndexedDB pour stocker les fichiers audio en cache
import { openDB, IDBPDatabase } from 'idb';

interface CachedAudio {
  url: string;
  blob: Blob;
  timestamp: number;
  lastAccessed: number;
}

// Configuration du cache
const CACHE_EXPIRY_DAYS = 7; // Durée de conservation des fichiers en cache
const CACHE_SIZE_LIMIT = 500 * 1024 * 1024; // Limite de taille du cache (500 MB)

// Base de données pour le cache audio
let dbPromise: Promise<IDBPDatabase> | null = null;

const initAudioCache = async (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB('audio-cache', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('audio-files')) {
          const store = db.createObjectStore('audio-files', { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      }
    });
  }
  return dbPromise;
};

/**
 * Vérifie si un fichier audio est dans le cache
 */
export const isInCache = async (url: string): Promise<boolean> => {
  try {
    const db = await initAudioCache();
    const cachedFile = await db.get('audio-files', url);
    return !!cachedFile;
  } catch (error) {
    console.error('Erreur lors de la vérification du cache:', error);
    return false;
  }
};

/**
 * Récupère un fichier audio du cache
 */
export const getFromCache = async (url: string): Promise<string | null> => {
  try {
    console.log("🔍 getFromCache appelé pour URL:", url);
    const db = await initAudioCache();
    console.log("✅ DB initialisée");
    
    const cachedFile = await db.get('audio-files', url);
    console.log("📦 Résultat DB get:", cachedFile ? "TROUVÉ" : "NULL");
    
    if (!cachedFile) {
      console.log("❌ Aucun fichier en cache pour cette URL");
      return null;
    }
    
    console.log("✅ Fichier trouvé en cache, taille:", (cachedFile.blob.size / 1024 / 1024).toFixed(2), "MB");
    
    // Met à jour la date de dernier accès
    await db.put('audio-files', {
      ...cachedFile,
      lastAccessed: Date.now()
    });
    
    // Crée une URL pour le blob
    const blobUrl = URL.createObjectURL(cachedFile.blob);
    console.log("✅ Blob URL créée:", blobUrl.substring(0, 50) + "...");
    return blobUrl;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération depuis le cache:', error);
    return null;
  }
};

/**
 * Ajoute un fichier audio au cache
 */
export const addToCache = async (url: string, blob: Blob): Promise<void> => {
  try {
    const db = await initAudioCache();
    const now = Date.now();
    
    // Vérifie si nous devons nettoyer le cache avant d'ajouter
    await cleanCacheIfNeeded();
    
    // Ajoute le fichier au cache
    await db.put('audio-files', {
      url,
      blob,
      timestamp: now,
      lastAccessed: now,
      size: blob.size
    });
    
    console.log(`Fichier audio mis en cache: ${url} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    console.error('Erreur lors de l\'ajout au cache:', error);
  }
};

/**
 * Nettoie le cache si nécessaire (trop volumineux ou trop ancien)
 */
const cleanCacheIfNeeded = async (): Promise<void> => {
  try {
    const db = await initAudioCache();
    const allFiles = await db.getAll('audio-files');
    
    // Supprime les fichiers expirés
    const expiryTime = Date.now() - (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    for (const file of allFiles) {
      if (file.lastAccessed < expiryTime) {
        await db.delete('audio-files', file.url);
        console.log(`Fichier expiré supprimé du cache: ${file.url}`);
      }
    }
    
    // Vérifie la taille totale du cache
    let totalSize = allFiles.reduce((sum, file) => sum + file.blob.size, 0);
    
    // Si le cache est trop volumineux, supprime les fichiers les moins utilisés récemment
    if (totalSize > CACHE_SIZE_LIMIT) {
      const sortedFiles = [...allFiles].sort((a, b) => a.lastAccessed - b.lastAccessed);
      
      for (const file of sortedFiles) {
        if (totalSize <= CACHE_SIZE_LIMIT * 0.8) break; // Nettoie jusqu'à 80% de la limite
        
        await db.delete('audio-files', file.url);
        totalSize -= file.blob.size;
        console.log(`Fichier supprimé du cache pour libérer de l'espace: ${file.url}`);
      }
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage du cache:', error);
  }
};

/**
 * Précharge un fichier audio
 */
export const preloadAudio = async (url: string): Promise<string | null> => {
  try {
    // Vérifie d'abord si le fichier est déjà en cache
    const cachedUrl = await getFromCache(url);
    if (cachedUrl) {
      console.log(`Utilisation du fichier audio en cache: ${url}`);
      return cachedUrl;
    }

    // Sinon, télécharge et met en cache
    console.log(`Préchargement du fichier audio: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erreur de téléchargement: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    await addToCache(url, blob);
    
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error(`Erreur lors du préchargement de l'audio: ${url}`, error);
    return null;
  }
};

/**
 * Obtient les statistiques du cache audio
 */
export const getAudioCacheStats = async (): Promise<{
  count: number;
  totalSize: number;
  oldestFile: number;
}> => {
  try {
    const db = await initAudioCache();
    const allFiles = await db.getAll('audio-files');
    
    return {
      count: allFiles.length,
      totalSize: allFiles.reduce((sum, file) => sum + file.blob.size, 0),
      oldestFile: allFiles.length > 0 
        ? Math.min(...allFiles.map(file => file.timestamp))
        : 0
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques du cache:', error);
    return { count: 0, totalSize: 0, oldestFile: 0 };
  }
};

/**
 * Met en cache UNIQUEMENT la chanson en cours de lecture
 * Supprime toutes les autres chansons du cache
 */
export const cacheCurrentSong = async (url: string, blob: Blob, songId: string): Promise<void> => {
  try {
    console.log("💾 cacheCurrentSong appelé - URL:", url, "Song ID:", songId, "Blob size:", (blob.size / 1024 / 1024).toFixed(2), "MB");
    
    const db = await initAudioCache();
    
    // Récupérer toutes les entrées du cache
    const allFiles = await db.getAll('audio-files');
    console.log("📦 Fichiers en cache avant nettoyage:", allFiles.length);
    
    // Supprimer toutes les entrées SAUF celle qu'on va ajouter
    for (const file of allFiles) {
      if (file.url !== url) {
        await db.delete('audio-files', file.url);
        console.log(`🗑️ Ancienne chanson supprimée du cache: ${file.url.substring(0, 50)}...`);
      }
    }
    
    // Ajouter la chanson actuelle
    const now = Date.now();
    await db.put('audio-files', {
      url,
      blob,
      timestamp: now,
      lastAccessed: now,
      size: blob.size
    });
    
    // Vérifier que l'ajout a réussi
    const verifyCache = await db.get('audio-files', url);
    console.log("✅ Vérification cache après ajout:", verifyCache ? "OK" : "ÉCHEC");
    
    // Sauvegarder l'info dans localStorage pour persistance après refresh
    const cacheInfo = {
      url,
      songId,
      timestamp: now
    };
    localStorage.setItem('cachedCurrentSong', JSON.stringify(cacheInfo));
    console.log("💾 localStorage mis à jour:", cacheInfo);
    
    console.log(`✅ Chanson actuelle mise en cache avec succès: ${url.substring(0, 50)}... (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    console.error('❌ Erreur lors de la mise en cache de la chanson actuelle:', error);
  }
};

/**
 * Vide complètement le cache audio
 */
export const clearAudioCache = async (): Promise<void> => {
  try {
    const db = await initAudioCache();
    await db.clear('audio-files');
    localStorage.removeItem('cachedCurrentSong');
    console.log('Cache audio vidé avec succès');
  } catch (error) {
    console.error('Erreur lors du vidage du cache audio:', error);
  }
};
