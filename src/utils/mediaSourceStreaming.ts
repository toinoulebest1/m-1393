/**
 * Media Source Extensions (MSE) pour streaming progressif ultra-rapide
 * Permet de commencer la lecture dès les premiers chunks reçus
 */
class MediaSourceStreaming {
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private audioElement: HTMLAudioElement | null = null;

  /**
   * Initialise le streaming MSE pour un élément audio
   */
  async initializeStreaming(audioElement: HTMLAudioElement, audioUrl: string): Promise<void> {
    try {
      // Vérifier le support MSE
      if (!('MediaSource' in window)) {
        console.warn('⚠️ MSE non supporté, fallback vers streaming classique');
        audioElement.src = audioUrl;
        return;
      }

      this.audioElement = audioElement;
      this.mediaSource = new MediaSource();
      
      const objectUrl = URL.createObjectURL(this.mediaSource);
      audioElement.src = objectUrl;

      // Attendre que MediaSource soit prêt
      await new Promise<void>((resolve, reject) => {
        if (!this.mediaSource) return reject();

        this.mediaSource.addEventListener('sourceopen', async () => {
          try {
            await this.startChunkedStreaming(audioUrl);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, { once: true });
      });

    } catch (error) {
      console.error('❌ Erreur initialisation MSE:', error);
      // Fallback vers streaming classique
      audioElement.src = audioUrl;
    }
  }

  /**
   * Démarre le streaming en chunks
   */
  private async startChunkedStreaming(audioUrl: string): Promise<void> {
    if (!this.mediaSource) return;

    try {
      // Créer un SourceBuffer avec le bon codec
      this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mpeg'); // MP3
      
      // Streamer par chunks de 64KB
      const CHUNK_SIZE = 64 * 1024;
      let offset = 0;

      const controller = new AbortController();
      const response = await fetch(audioUrl, {
        headers: { 'Range': `bytes=0-` },
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error('Échec du streaming');
      }

      const reader = response.body.getReader();
      const contentLength = parseInt(response.headers.get('Content-Length') || '0');

      console.log('🎵 Streaming MSE démarré, taille:', contentLength);

      // Lire et ajouter les chunks au fur et à mesure
      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Finaliser le MediaSource
          if (this.mediaSource && this.mediaSource.readyState === 'open') {
            this.mediaSource.endOfStream();
          }
          break;
        }

        chunks.push(value);
        receivedLength += value.length;

        // Ajouter au SourceBuffer dès qu'on a 64KB
        if (receivedLength >= CHUNK_SIZE || receivedLength === contentLength) {
          await this.appendChunk(chunks);
          chunks.length = 0; // Vider les chunks
        }

        // Démarrer la lecture dès les premiers 64KB reçus
        if (offset === 0 && receivedLength >= CHUNK_SIZE && this.audioElement) {
          console.log('▶️ Démarrage lecture après', receivedLength, 'bytes');
          this.audioElement.play().catch(e => console.warn('Play error:', e));
        }

        offset += value.length;
      }

    } catch (error) {
      console.error('❌ Erreur streaming MSE:', error);
      throw error;
    }
  }

  /**
   * Ajoute un chunk au SourceBuffer
   */
  private async appendChunk(chunks: Uint8Array[]): Promise<void> {
    if (!this.sourceBuffer || chunks.length === 0) return;

    // Concaténer les chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const concatenated = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    // Attendre que le SourceBuffer soit prêt
    if (this.sourceBuffer.updating) {
      await new Promise<void>(resolve => {
        if (!this.sourceBuffer) return resolve();
        this.sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
      });
    }

    // Ajouter le chunk
    this.sourceBuffer.appendBuffer(concatenated);

    // Attendre la fin de l'ajout
    await new Promise<void>(resolve => {
      if (!this.sourceBuffer) return resolve();
      this.sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
    });
  }

  /**
   * Nettoie les ressources MSE
   */
  cleanup(): void {
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      this.mediaSource.endOfStream();
    }
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.audioElement = null;
  }
}

export const mediaSourceStreaming = new MediaSourceStreaming();
