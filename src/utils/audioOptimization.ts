/**
 * Configuration minimale d'un élément audio
 */
export const optimizeAudioElement = (audio: HTMLAudioElement): HTMLAudioElement => {
  audio.crossOrigin = "anonymous";
  audio.preload = "none"; // Ne rien précharger automatiquement
  audio.controls = false;
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
