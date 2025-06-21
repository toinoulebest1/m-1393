
/**
 * Gestionnaire d'autoplay pour contourner les restrictions des navigateurs
 */

export class AutoplayManager {
  private static hasUserInteracted = false;
  private static audioContext: AudioContext | null = null;
  private static pendingPlay: (() => void) | null = null;
  private static activationOverlayVisible = false;

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
   * Joue un audio en gérant l'autoplay avec prompt automatique
   */
  static async playAudio(audio: HTMLAudioElement): Promise<boolean> {
    try {
      // Vérifier si l'autoplay est possible
      const canPlay = await this.canAutoplay();
      
      if (!canPlay && !this.hasUserInteracted) {
        console.log("⚠️ Autoplay bloqué - affichage prompt automatique");
        
        // Stocker la lecture en attente
        this.pendingPlay = () => {
          audio.play().catch(console.error);
        };
        
        // Afficher automatiquement le prompt
        this.showActivationPrompt();
        return false;
      }

      // Démarrer AudioContext si nécessaire
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Tenter la lecture avec gestion d'erreur améliorée
      try {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log("✅ Lecture démarrée avec succès");
          return true;
        }
      } catch (playError) {
        console.error("❌ Erreur play():", playError);
        
        // Si c'est une erreur d'autoplay, afficher le prompt
        if (playError.name === 'NotAllowedError') {
          this.pendingPlay = () => {
            audio.play().catch(console.error);
          };
          this.showActivationPrompt();
          return false;
        }
        
        throw playError;
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
   * Affiche un prompt d'activation audio automatiquement
   */
  private static showActivationPrompt(): void {
    // Éviter les doublons
    if (this.activationOverlayVisible) {
      console.log("👁️ Prompt déjà visible, ignoré");
      return;
    }
    
    this.activationOverlayVisible = true;
    console.log("🎵 Affichage prompt d'activation automatique");
    
    // Créer un overlay d'activation
    const overlay = document.createElement('div');
    overlay.id = 'audio-activation-overlay';
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-300';
    
    overlay.innerHTML = `
      <div class="bg-spotify-dark border border-spotify-border rounded-lg p-6 text-center max-w-md mx-4 animate-in zoom-in duration-300">
        <div class="w-16 h-16 bg-spotify-accent rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">🎵 Activer l'audio</h3>
        <p class="text-spotify-neutral mb-6">
          Votre navigateur nécessite une interaction pour jouer de l'audio.
          <br><strong>Cliquez sur le bouton ci-dessous pour commencer la lecture.</strong>
        </p>
        <button 
          id="activate-audio-btn"
          class="bg-spotify-accent hover:bg-spotify-accent/80 text-white font-medium px-6 py-3 rounded-full transition-colors transform hover:scale-105"
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
      this.activationOverlayVisible = false;
      this.createAudioContext();
      
      // Exécuter la lecture en attente
      if (this.pendingPlay) {
        console.log("🚀 Exécution lecture en attente");
        this.pendingPlay();
        this.pendingPlay = null;
      }
      
      // Supprimer l'overlay avec animation
      overlay.classList.add('animate-out', 'fade-out', 'duration-200');
      setTimeout(() => {
        overlay.remove();
      }, 200);
      
      console.log("🎵 Audio activé par l'utilisateur - lecture démarrée");
    });
    
    // Fermeture en cliquant en dehors
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        activateBtn?.click();
      }
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

  /**
   * Force l'activation pour les tests
   */
  static forceActivation(): void {
    this.hasUserInteracted = true;
    this.createAudioContext();
    console.log("🎵 Activation forcée pour tests");
  }
}

// Initialiser automatiquement
AutoplayManager.initialize();
