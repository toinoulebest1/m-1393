/**
 * Gestionnaire de connexions Keep-Alive persistantes
 * Maintient des connexions HTTP ouvertes pour éviter les handshakes répétés
 */
class KeepAliveManager {
  private warmConnections: Map<string, number> = new Map();
  private readonly WARMUP_INTERVAL = 30000; // Réchauffer toutes les 30s
  private intervalId: number | null = null;

  constructor() {
    this.startWarmupCycle();
  }

  /**
   * Démarre le cycle de réchauffement des connexions
   */
  private startWarmupCycle(): void {
    // Réchauffer immédiatement
    this.warmupConnections();

    // Puis toutes les 30 secondes
    this.intervalId = window.setInterval(() => {
      this.warmupConnections();
    }, this.WARMUP_INTERVAL);
  }

  /**
   * Réchauffe les connexions en faisant des requêtes HEAD légères
   */
  private async warmupConnections(): Promise<void> {
    const endpoints = [
      'https://api.deezmate.com/health',
      'https://pwknncursthenghqgevl.supabase.co/storage/v1/object/public/audio'
    ];

    console.log('🔥 Réchauffement des connexions Keep-Alive');

    const promises = endpoints.map(async (endpoint) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout

        await fetch(endpoint, {
          method: 'HEAD',
          signal: controller.signal,
          keepalive: true, // Keep-Alive header
          headers: {
            'Connection': 'keep-alive'
          }
        });

        clearTimeout(timeoutId);
        this.warmConnections.set(endpoint, Date.now());
        console.log('✅ Connexion réchauffée:', endpoint);
      } catch (error) {
        console.warn('⚠️ Échec réchauffement:', endpoint);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Crée une requête fetch avec Keep-Alive optimisé
   */
  createFetchWithKeepAlive(url: string, options: RequestInit = {}): Promise<Response> {
    return fetch(url, {
      ...options,
      keepalive: true,
      headers: {
        ...options.headers,
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=60, max=1000'
      }
    });
  }

  /**
   * Arrête le cycle de réchauffement
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Statistiques des connexions
   */
  getStats() {
    return {
      warmConnections: Array.from(this.warmConnections.entries()).map(([endpoint, lastWarmup]) => ({
        endpoint,
        lastWarmup,
        age: Date.now() - lastWarmup
      }))
    };
  }
}

export const keepAliveManager = new KeepAliveManager();
