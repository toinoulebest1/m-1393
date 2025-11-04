
/**
 * Préchargement Prédictif Avancé avec IA Simple
 */

import { Song } from '@/types/player';
import { UltraFastStreaming } from './ultraFastStreaming';

interface PredictionContext {
  timeOfDay: number; // 0-23
  dayOfWeek: number; // 0-6
  genre?: string;
  artist?: string;
  mood?: string;
  lastGenres: string[];
  lastArtists: string[];
  playHistory: { songId: string; timestamp: number }[];
}

interface PredictionScore {
  songId: string;
  score: number;
  reasons: string[];
}

export class PredictivePreloader {
  private static context: PredictionContext = {
    timeOfDay: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    lastGenres: [],
    lastArtists: [],
    playHistory: []
  };

  /**
   * Mise à jour du contexte avec la chanson actuelle
   */
  static updateContext(song: Song): void {
    const now = new Date();
    this.context.timeOfDay = now.getHours();
    this.context.dayOfWeek = now.getDay();
    
    if (song.genre) {
      this.context.lastGenres.unshift(song.genre);
      this.context.lastGenres = this.context.lastGenres.slice(0, 5);
    }
    
    if (song.artist) {
      this.context.lastArtists.unshift(song.artist);
      this.context.lastArtists = this.context.lastArtists.slice(0, 5);
    }
    
    this.context.playHistory.unshift({
      songId: song.id,
      timestamp: Date.now()
    });
    this.context.playHistory = this.context.playHistory.slice(0, 50);
    
    console.log("🤖 Contexte mis à jour:", {
      timeOfDay: this.context.timeOfDay,
      genre: song.genre,
      artist: song.artist
    });
  }

  /**
   * Prédiction intelligente des prochaines chansons
   */
  static predictNextSongs(currentSong: Song, queue: Song[]): Song[] {
    console.log("🧠 Prédiction IA avancée");
    
    const predictions: PredictionScore[] = [];
    
    // Analyser chaque chanson de la queue
    for (const song of queue) {
      if (song.id === currentSong.id) continue;
      
      const score = this.calculatePredictionScore(song, currentSong);
      if (score.score > 0.3) { // Seuil de pertinence
        predictions.push(score);
      }
    }
    
    // Trier par score décroissant
    predictions.sort((a, b) => b.score - a.score);
    
    // Retourner les top 5
    const topPredictions = predictions.slice(0, 5);
    
    console.log("🎯 Top prédictions:", topPredictions.map(p => ({
      score: p.score.toFixed(2),
      reasons: p.reasons
    })));
    
    return topPredictions
      .map(p => queue.find(s => s.id === p.songId))
      .filter(Boolean) as Song[];
  }

  /**
   * Calcul du score de prédiction
   */
  private static calculatePredictionScore(song: Song, currentSong: Song): PredictionScore {
    let score = 0;
    const reasons: string[] = [];
    
    // 1. Même artiste (fort poids)
    if (song.artist === currentSong.artist) {
      score += 0.4;
      reasons.push("même artiste");
    }
    
    // 2. Même genre (poids moyen)
    if (song.genre && currentSong.genre && song.genre === currentSong.genre) {
      score += 0.3;
      reasons.push("même genre");
    }
    
    // 3. Genres récents (poids faible)
    if (song.genre && this.context.lastGenres.includes(song.genre)) {
      score += 0.2;
      reasons.push("genre récent");
    }
    
    // 4. Artistes récents (poids faible)
    if (song.artist && this.context.lastArtists.includes(song.artist)) {
      score += 0.2;
      reasons.push("artiste récent");
    }
    
    // 5. Historique de lecture
    const playedRecently = this.context.playHistory
      .some(h => h.songId === song.id && Date.now() - h.timestamp < 24 * 60 * 60 * 1000);
    if (playedRecently) {
      score += 0.15;
      reasons.push("joué récemment");
    }
    
    // 6. Heure de la journée (patterns temporels)
    const timeBonus = this.getTimeBonus(song);
    if (timeBonus > 0) {
      score += timeBonus;
      reasons.push("pattern temporel");
    }
    
    // 7. Bonus aléatoire pour diversité
    score += Math.random() * 0.1;
    
    return {
      songId: song.id,
      score: Math.min(score, 1), // Cap à 1
      reasons
    };
  }

  /**
   * Bonus basé sur l'heure (patterns d'écoute)
   */
  private static getTimeBonus(song: Song): number {
    const hour = this.context.timeOfDay;
    
    // Musique énergique le matin
    if (hour >= 6 && hour <= 10) {
      if (song.genre && ['Pop', 'Rock', 'Electronic'].includes(song.genre)) {
        return 0.15;
      }
    }
    
    // Musique relaxante le soir
    if (hour >= 20 || hour <= 2) {
      if (song.genre && ['Jazz', 'Classical', 'Ambient'].includes(song.genre)) {
        return 0.15;
      }
    }
    
    // Musique de travail en journée
    if (hour >= 9 && hour <= 17) {
      if (song.genre && ['Lo-fi', 'Instrumental', 'Classical'].includes(song.genre)) {
        return 0.1;
      }
    }
    
    return 0;
  }

  /**
   * Préchargement prédictif ultra-agressif
   */
  static async preloadPredicted(predictions: Song[]): Promise<void> {
    if (predictions.length === 0) return;
    
    console.log("🚀 Préchargement prédictif:", predictions.length, "chansons");
    
    // Précharger en parallèle avec priorité
    const promises = predictions.map(async (song, index) => {
      const delay = index * 10; // 10ms entre chaque
      
      setTimeout(async () => {
        try {
          await UltraFastStreaming.getAudioUrlUltraFast(
            song.url,
            song.deezer_id,
            song.title,
            song.artist,
            song.id
          );
          console.log("✅ Prédiction préchargée:", song.title);
        } catch (error) {
          console.warn("⚠️ Préchargement prédictif échoué:", song.title);
        }
      }, delay);
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Sauvegarde du contexte
   */
  static saveContext(): void {
    try {
      localStorage.setItem('predictiveContext', JSON.stringify(this.context));
    } catch (error) {
      console.warn("⚠️ Sauvegarde contexte échouée");
    }
  }

  /**
   * Restauration du contexte
   */
  static loadContext(): void {
    try {
      const saved = localStorage.getItem('predictiveContext');
      if (saved) {
        this.context = { ...this.context, ...JSON.parse(saved) };
        console.log("📂 Contexte restauré");
      }
    } catch (error) {
      console.warn("⚠️ Restauration contexte échouée");
    }
  }

  /**
   * Statistiques de prédiction
   */
  static getStats() {
    return {
      historySize: this.context.playHistory.length,
      lastGenres: this.context.lastGenres,
      lastArtists: this.context.lastArtists,
      timeOfDay: this.context.timeOfDay,
      dayOfWeek: this.context.dayOfWeek
    };
  }
}

// Chargement automatique du contexte
PredictivePreloader.loadContext();

// Sauvegarde automatique toutes les 30 secondes
setInterval(() => {
  PredictivePreloader.saveContext();
}, 30000);
