
/**
 * Web Worker pour préchargement en arrière-plan
 * Évite de bloquer le thread principal
 */

console.log("🔧 Preload Worker initialisé");

// Cache du worker
const workerCache = new Map();

// Fonction de préchargement
async function preloadAudio(url, songUrl) {
  try {
    console.log("🔧 Worker préchargement:", songUrl);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    workerCache.set(songUrl, arrayBuffer);
    
    // Notifier le thread principal
    self.postMessage({
      type: 'PRELOAD_COMPLETE',
      songUrl: songUrl,
      success: true,
      size: arrayBuffer.byteLength
    });
    
    console.log("✅ Worker préchargement terminé:", songUrl);
  } catch (error) {
    console.error("❌ Worker préchargement échoué:", error);
    
    self.postMessage({
      type: 'PRELOAD_COMPLETE',
      songUrl: songUrl,
      success: false,
      error: error.message
    });
  }
}

// Gestionnaire de messages
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'PRELOAD_AUDIO':
      await preloadAudio(data.audioUrl, data.songUrl);
      break;
      
    case 'PRELOAD_BATCH':
      console.log("🚀 Worker batch:", data.urls.length, "URLs");
      
      // Précharger en parallèle avec limitation
      const semaphore = 3; // Max 3 en parallèle
      let active = 0;
      let index = 0;
      
      const processBatch = async () => {
        while (index < data.urls.length) {
          if (active >= semaphore) {
            await new Promise(resolve => setTimeout(resolve, 10));
            continue;
          }
          
          const item = data.urls[index++];
          active++;
          
          preloadAudio(item.audioUrl, item.songUrl).finally(() => {
            active--;
          });
        }
      };
      
      await processBatch();
      break;
      
    case 'GET_STATS':
      self.postMessage({
        type: 'STATS_RESPONSE',
        stats: {
          cacheSize: workerCache.size,
          totalBytes: Array.from(workerCache.values())
            .reduce((sum, buffer) => sum + buffer.byteLength, 0)
        }
      });
      break;
      
    case 'CLEAR_CACHE':
      workerCache.clear();
      console.log("🧹 Worker cache nettoyé");
      break;
  }
});

// Nettoyage automatique toutes les 5 minutes
setInterval(() => {
  // Garder seulement les 20 plus récents
  if (workerCache.size > 20) {
    const entries = Array.from(workerCache.entries());
    const toKeep = entries.slice(-20);
    
    workerCache.clear();
    toKeep.forEach(([key, value]) => workerCache.set(key, value));
    
    console.log("🧹 Worker nettoyage automatique");
  }
}, 5 * 60 * 1000);
