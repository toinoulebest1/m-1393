
/**
 * Gestionnaire d'autoplay pour contourner les restrictions des navigateurs
 */

export class AutoplayManager {
  private static hasUserInteracted = false;
  private static audioContext: AudioContext | null = null;
  private static pendingPlay: (() => void) | null = null;

  /**
   * Initialise le gestionnaire d'autoplay
   */
  static initialize(): void {
    // Écouter les premières interactions utilisateur
    const interactionEvents = ['click', 'touchstart', 'keydown', 'mousedown'];
    
    const handleInteraction = () => {
      this.hasUserInteracted = true;
      console.log("🎵 Interaction utilisateur détectée - autoplay autorisé");
      
      // Créer l'AudioContext après interaction
      this.createAudioContext();
      
      // Exécuter une lecture en attente
      if (this.pendingPlay) {
        this.pendingPlay();
        this.pendingPlay = null;
      }
      
      // Nettoyer les listeners
      interactionEvents.forEach(event => {
        document.removeEventListener(event, handleInteraction);
      });
    };

    interactionEvents.forEach(event => {
      document.addEventListener(event, handleInteraction, { once: true });
    });
  }

  /**
   * Crée un AudioContext pour débloquer l'audio
   */
  private static createAudioContext(): void {
    try {
      // @ts-ignore
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !this.audioContext) {
        this.audioContext = new AudioContextClass();
        
        // Démarrer le contexte si suspendu
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }
        
        console.log("🎵 AudioContext créé:", this.audioContext.state);
      }
    } catch (error) {
      console.warn("⚠️ Erreur création AudioContext:", error);
    }
  }

  /**
   * Vérifie si l'autoplay est possible
   */
  static async canAutoplay(): Promise<boolean> {
    // Firefox permet généralement l'autoplay
    if (navigator.userAgent.includes('Firefox')) {
      return true;
    }

    // Test avec un audio silencieux
    try {
      const audio = new Audio();
      audio.volume = 0.1;
      audio.muted = true;
      
      // Créer un son silencieux
      const silentAudio = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmYgBSuByvLZiDQIG2m98OScTgwOVanl7lIeB';
      audio.src = silentAudio;
      
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        audio.pause();
        console.log("✅ Autoplay autorisé");
        return true;
      }
    } catch (error) {
      console.log("❌ Autoplay bloqué:", error);
    }
    
    return this.hasUserInteracted;
  }

  /**
   * Joue un audio en gérant l'autoplay (optimisé)
   */
  static async playAudio(audio: HTMLAudioElement): Promise<boolean> {
    try {
      // Si on a déjà une interaction, lancer directement
      if (this.hasUserInteracted) {
        // Démarrer AudioContext si nécessaire (non-bloquant)
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(console.warn);
        }

        // Lecture directe
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log("✅ Lecture démarrée");
          return true;
        }
      } else {
        // Seulement tester l'autoplay si pas d'interaction précédente
        const canPlay = await this.canAutoplay();
        
        if (!canPlay) {
          console.log("⚠️ Autoplay bloqué - en attente d'interaction");
          
          // Stocker la lecture en attente
          this.pendingPlay = () => {
            audio.play().catch(console.error);
          };
          
          // Afficher un bouton d'activation
          this.showActivationPrompt();
          return false;
        }

        // Démarrer AudioContext si nécessaire
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        // Tenter la lecture
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log("✅ Lecture démarrée");
          return true;
        }
      }
    } catch (error) {
      console.error("❌ Erreur lecture audio:", error);
      
      if (error.name === 'NotAllowedError') {
        this.showActivationPrompt();
      }
    }
    
    return false;
  }

  /**
   * Affiche un prompt d'activation audio
   */
  private static showActivationPrompt(): void {
    // Créer un overlay d'activation
    const overlay = document.createElement('div');
    overlay.id = 'audio-activation-overlay';
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]';
    
    overlay.innerHTML = `
      <div class="bg-spotify-dark border border-spotify-border rounded-lg p-6 text-center max-w-md mx-4">
        <div class="w-16 h-16 bg-spotify-accent rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">Activer l'audio</h3>
        <p class="text-spotify-neutral mb-6">
          Votre navigateur nécessite une interaction pour jouer de l'audio.
          Cliquez sur le bouton ci-dessous pour commencer.
        </p>
        <button 
          id="activate-audio-btn"
          class="bg-spotify-accent hover:bg-spotify-accent/80 text-white font-medium px-6 py-3 rounded-full transition-colors"
        >
          🎵 Activer la musique
        </button>
      </div>
    `;
    
    // Ajouter l'overlay
    document.body.appendChild(overlay);
    
    // Gérer le clic d'activation
    const activateBtn = overlay.querySelector('#activate-audio-btn');
    activateBtn?.addEventListener('click', () => {
      this.hasUserInteracted = true;
      this.createAudioContext();
      
      // Exécuter la lecture en attente
      if (this.pendingPlay) {
        this.pendingPlay();
        this.pendingPlay = null;
      }
      
      // Supprimer l'overlay
      overlay.remove();
      
      console.log("🎵 Audio activé par l'utilisateur");
    });
  }

  /**
   * Vérifie le support des navigateurs
   */
  static getBrowserInfo(): { name: string; supportsAutoplay: boolean } {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Firefox')) {
      return { name: 'Firefox', supportsAutoplay: true };
    } else if (userAgent.includes('Chrome')) {
      return { name: 'Chrome', supportsAutoplay: false };
    } else if (userAgent.includes('Safari')) {
      return { name: 'Safari', supportsAutoplay: false };
    } else if (userAgent.includes('Edge')) {
      return { name: 'Edge', supportsAutoplay: false };
    }
    
    return { name: 'Inconnu', supportsAutoplay: false };
  }
}

// Initialiser automatiquement
AutoplayManager.initialize();
