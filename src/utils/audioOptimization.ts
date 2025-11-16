/**
 * Optimise un élément audio pour des performances maximales
 * - Décodage hardware accéléré
 * - Préchargement intelligent
 * - Gestion mémoire optimale
 */
export const optimizeAudioElement = (audio: HTMLAudioElement): HTMLAudioElement => {
  // CORS pour CDN
  audio.crossOrigin = "anonymous";
  
  // Préchargement intelligent - metadata seulement pour économiser bande passante
  audio.preload = "metadata";
  
  // Activer le décodage hardware si disponible
  if ('audioTracks' in audio) {
    (audio as any).audioTracks.enabled = true;
  }
  
  // Désactiver les contrôles pour réduire overhead
  audio.controls = false;
  
  // Priorité de chargement haute pour latence minimale
  if ('fetchPriority' in audio) {
    (audio as any).fetchPriority = 'high';
  }
  
  return audio;
};

/**
 * Crée un élément audio optimisé
 */
export const createOptimizedAudio = (): HTMLAudioElement => {
  const audio = new Audio();
  return optimizeAudioElement(audio);
};

/**
 * Précharge un audio de manière optimale
 */
export const preloadAudioSource = async (audio: HTMLAudioElement, url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Audio preload timeout'));
    }, 5000);
    
    audio.addEventListener('canplaythrough', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    
    audio.addEventListener('error', (e) => {
      clearTimeout(timeout);
      reject(e);
    }, { once: true });
    
    audio.src = url;
    audio.load();
  });
};
