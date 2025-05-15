
// Implémentation d'un lecteur audio basé sur Web Audio API
// Cette classe permet un contrôle plus fin du son et permet d'accéder à des fonctionnalités avancées

class WebAudioPlayer {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private offset: number = 0;
  private _duration: number = 0;
  private isPlaying: boolean = false;
  private _volume: number = 1;
  private _playbackRate: number = 1;
  
  // Pour stocker la fonction d'avancement de la lecture
  private onTimeUpdateCallback: (() => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private timeUpdateInterval: number | null = null;
  
  constructor() {
    // L'AudioContext sera créé lors de la première interaction utilisateur
    try {
      window.AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    } catch (e) {
      console.error("Web Audio API n'est pas pris en charge par ce navigateur", e);
    }
  }
  
  private initializeAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = this._volume;
        console.log("AudioContext initialisé avec succès");
      } catch (e) {
        console.error("Erreur lors de l'initialisation de l'AudioContext", e);
      }
    }
    return !!this.audioContext;
  }
  
  async loadAudio(url: string): Promise<boolean> {
    console.log("Chargement de l'audio via Web Audio API:", url);
    
    if (!this.initializeAudioContext() || !this.audioContext) {
      console.error("Impossible d'initialiser l'AudioContext");
      return false;
    }
    
    try {
      this.reset();
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this._duration = this.audioBuffer.duration;
      
      console.log("Audio chargé avec succès, durée:", this._duration);
      return true;
    } catch (error) {
      console.error("Erreur lors du chargement de l'audio:", error);
      return false;
    }
  }
  
  play(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioContext || !this.audioBuffer) {
        reject(new Error("Audio non chargé"));
        return;
      }
      
      try {
        // Si déjà en lecture, arrêter d'abord
        if (this.isPlaying) {
          this.stop();
        }
        
        // Relancer l'AudioContext s'il est suspendu (politique autoplay)
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume();
        }
        
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.connect(this.gainNode!);
        
        // Configurer la vitesse de lecture
        this.sourceNode.playbackRate.value = this._playbackRate;
        
        // Gérer l'événement 'ended'
        this.sourceNode.onended = () => {
          if (this.isPlaying) {
            this.isPlaying = false;
            if (this.onEndedCallback) {
              this.onEndedCallback();
            }
            this.clearTimeUpdateInterval();
          }
        };
        
        // Démarrer la lecture
        this.startTime = this.audioContext.currentTime;
        this.sourceNode.start(0, this.offset);
        this.isPlaying = true;
        
        // Configurer l'intervalle de mise à jour du temps
        this.setupTimeUpdateInterval();
        
        console.log("Lecture démarrée à la position", this.offset);
        resolve();
      } catch (error) {
        console.error("Erreur lors du démarrage de la lecture:", error);
        reject(error);
      }
    });
  }
  
  pause(): void {
    if (!this.isPlaying || !this.audioContext) return;
    
    try {
      this.offset = this.currentTime;
      this.stop();
      console.log("Lecture mise en pause à la position", this.offset);
    } catch (error) {
      console.error("Erreur lors de la mise en pause:", error);
    }
  }
  
  stop(): void {
    if (!this.sourceNode) return;
    
    try {
      this.sourceNode.stop(0);
      this.sourceNode.disconnect();
      this.sourceNode = null;
      this.isPlaying = false;
      this.clearTimeUpdateInterval();
    } catch (error) {
      console.error("Erreur lors de l'arrêt de la lecture:", error);
    }
  }
  
  reset(): void {
    if (this.isPlaying) {
      this.stop();
    }
    this.offset = 0;
    this.startTime = 0;
  }
  
  set volume(value: number) {
    this._volume = value;
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }
  
  get volume(): number {
    return this._volume;
  }
  
  set currentTime(value: number) {
    if (value < 0 || (this.audioBuffer && value > this.audioBuffer.duration)) {
      console.warn("Temps spécifié hors limites");
      return;
    }
    
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.stop();
    }
    
    this.offset = value;
    
    if (wasPlaying) {
      this.play().catch(err => console.error("Erreur lors de la reprise après seek:", err));
    }
  }
  
  get currentTime(): number {
    if (!this.audioContext || !this.isPlaying) {
      return this.offset;
    }
    
    const elapsed = this.audioContext.currentTime - this.startTime;
    return Math.min(this.offset + elapsed, this.duration);
  }
  
  get duration(): number {
    return this._duration;
  }
  
  set playbackRate(value: number) {
    this._playbackRate = value;
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = value;
    }
  }
  
  get playbackRate(): number {
    return this._playbackRate;
  }
  
  setOnTimeUpdate(callback: () => void): void {
    this.onTimeUpdateCallback = callback;
  }
  
  setOnEnded(callback: () => void): void {
    this.onEndedCallback = callback;
  }
  
  private setupTimeUpdateInterval(): void {
    this.clearTimeUpdateInterval();
    if (this.onTimeUpdateCallback) {
      this.timeUpdateInterval = window.setInterval(() => {
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback();
        }
      }, 200); // Mise à jour toutes les 200ms
    }
  }
  
  private clearTimeUpdateInterval(): void {
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }
  
  isAudioContextActive(): boolean {
    return this.audioContext !== null && this.audioContext.state === 'running';
  }
}

// Créer l'instance du lecteur Web Audio
export const webAudioPlayer = new WebAudioPlayer();

// Pour la compatibilité dans certaines parties du code
// Ajout du type pour l'objet window
declare global {
  interface Window {
    webAudioPlayer: WebAudioPlayer;
    globalAudio: HTMLAudioElement;
  }
}

// Exposer webAudioPlayer à l'objet window
window.webAudioPlayer = webAudioPlayer;

// Interface pour le changement de type de lecteur
export enum PlayerType {
  NATIVE = 'native',
  WEB_AUDIO = 'web_audio'
}

export { WebAudioPlayer };
