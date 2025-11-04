/**
 * Circuit Breaker Pattern pour éviter d'appeler des APIs down
 * Si une API échoue 3 fois de suite, on la bypass pendant 30s
 */

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

class CircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map();
  private readonly maxFailures = 3;
  private readonly resetTimeout = 30000; // 30 secondes

  /**
   * Vérifie si le circuit est ouvert (API considérée down)
   */
  isOpen(apiName: string): boolean {
    const state = this.states.get(apiName);
    if (!state || !state.isOpen) return false;

    // Vérifier si le timeout de reset est écoulé
    const now = Date.now();
    if (now - state.lastFailureTime >= this.resetTimeout) {
      console.log(`🔄 Circuit Breaker: Réinitialisation de ${apiName}`);
      this.reset(apiName);
      return false;
    }

    return true;
  }

  /**
   * Enregistre un succès (réinitialise le compteur)
   */
  recordSuccess(apiName: string): void {
    this.reset(apiName);
  }

  /**
   * Enregistre un échec
   */
  recordFailure(apiName: string): void {
    const state = this.states.get(apiName) || {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false
    };

    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= this.maxFailures) {
      state.isOpen = true;
      console.warn(`⚠️ Circuit Breaker: ${apiName} désactivé pour ${this.resetTimeout/1000}s`);
    }

    this.states.set(apiName, state);
  }

  /**
   * Réinitialise le circuit breaker pour une API
   */
  private reset(apiName: string): void {
    this.states.set(apiName, {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false
    });
  }

  /**
   * Obtient les statistiques du circuit breaker
   */
  getStats(): Record<string, CircuitBreakerState> {
    const stats: Record<string, CircuitBreakerState> = {};
    this.states.forEach((state, apiName) => {
      stats[apiName] = { ...state };
    });
    return stats;
  }
}

export const circuitBreaker = new CircuitBreaker();
