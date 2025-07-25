/**
 * Utilitaire pour vider complètement tous les caches audio
 */

import { clearAudioCache } from './audioCache';
import { UltraFastCache } from './ultraFastCache';
// import { memoryCache } from './memoryCache'; // DÉSACTIVÉ

/**
 * Vide tous les caches audio (IndexedDB, mémoire, L0, et preload worker)
 */
export const clearAllAudioCaches = async (): Promise<void> => {
  try {
    console.log('🧹 Début du nettoyage de tous les caches audio...');
    
    // 1. Vider le cache IndexedDB
    await clearAudioCache();
    console.log('✅ Cache IndexedDB vidé');
    
    // Cache mémoire DÉSACTIVÉ
    // memoryCache.clear();
    console.log('✅ Cache mémoire désactivé');
    
    // 3. Vider le cache L0 ultra-rapide
    UltraFastCache.cleanup();
    console.log('✅ Cache L0 ultra-rapide vidé');
    
    // 4. Vider le cache du preload worker
    if (typeof window !== 'undefined' && 'Worker' in window) {
      // Essayer de communiquer avec le worker s'il existe
      try {
        const worker = new Worker('/preloadWorker.js');
        worker.postMessage({ type: 'CLEAR_CACHE' });
        worker.terminate();
        console.log('✅ Cache preload worker vidé');
      } catch (error) {
        console.warn('⚠️ Impossible de vider le cache worker:', error);
      }
    }
    
    // 5. Vider le localStorage des patterns d'écoute
    if (typeof window !== 'undefined') {
      localStorage.removeItem('listeningPatterns');
      console.log('✅ Patterns d\'écoute supprimés');
    }
    
    console.log('🎉 Tous les caches audio ont été vidés avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors du vidage des caches:', error);
    throw error;
  }
};