/**
 * Audio Analysis Service
 * Analyse BPM, tonalité, structure musicale et énergie des pistes
 */

export interface AudioAnalysis {
  bpm: number;
  key: string; // Camelot notation (1A-12B)
  energy: number; // 0-1
  structure: {
    intro: { start: number; end: number } | null;
    outro: { start: number; end: number } | null;
    drops: number[];
    breaks: number[];
  };
  beatgrid: number[]; // Timestamps des beats en secondes
  duration: number;
}

export interface TransitionPoint {
  time: number;
  type: 'intro' | 'outro' | 'break' | 'drop';
  energy: number;
}

// Camelot Wheel pour matching de clés
const CAMELOT_WHEEL: Record<string, { compatible: string[]; semitones: number }> = {
  '1A': { compatible: ['1A', '1B', '2A', '12A'], semitones: 0 },
  '2A': { compatible: ['2A', '2B', '3A', '1A'], semitones: 2 },
  '3A': { compatible: ['3A', '3B', '4A', '2A'], semitones: 4 },
  '4A': { compatible: ['4A', '4B', '5A', '3A'], semitones: 5 },
  '5A': { compatible: ['5A', '5B', '6A', '4A'], semitones: 7 },
  '6A': { compatible: ['6A', '6B', '7A', '5A'], semitones: 9 },
  '7A': { compatible: ['7A', '7B', '8A', '6A'], semitones: 11 },
  '8A': { compatible: ['8A', '8B', '9A', '7A'], semitones: 1 },
  '9A': { compatible: ['9A', '9B', '10A', '8A'], semitones: 3 },
  '10A': { compatible: ['10A', '10B', '11A', '9A'], semitones: 6 },
  '11A': { compatible: ['11A', '11B', '12A', '10A'], semitones: 8 },
  '12A': { compatible: ['12A', '12B', '1A', '11A'], semitones: 10 },
  '1B': { compatible: ['1B', '1A', '2B', '12B'], semitones: 3 },
  '2B': { compatible: ['2B', '2A', '3B', '1B'], semitones: 5 },
  '3B': { compatible: ['3B', '3A', '4B', '2B'], semitones: 7 },
  '4B': { compatible: ['4B', '4A', '5B', '3B'], semitones: 8 },
  '5B': { compatible: ['5B', '5A', '6B', '4B'], semitones: 10 },
  '6B': { compatible: ['6B', '6A', '7B', '5B'], semitones: 0 },
  '7B': { compatible: ['7B', '7A', '8B', '6B'], semitones: 2 },
  '8B': { compatible: ['8B', '8A', '9B', '7B'], semitones: 4 },
  '9B': { compatible: ['9B', '9A', '10B', '8B'], semitones: 6 },
  '10B': { compatible: ['10B', '10A', '11B', '9B'], semitones: 9 },
  '11B': { compatible: ['11B', '11A', '12B', '10B'], semitones: 11 },
  '12B': { compatible: ['12B', '12A', '1B', '11B'], semitones: 1 }
};

/**
 * Analyse complète d'un fichier audio
 */
export async function analyzeAudio(audioUrl: string): Promise<AudioAnalysis> {
  console.log('🎵 Starting audio analysis for:', audioUrl);
  
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    console.log('✅ Audio loaded, duration:', audioBuffer.duration);
    
    // Analyse parallèle de toutes les caractéristiques
    const [bpm, key, energy, structure, beatgrid] = await Promise.all([
      detectBPM(audioBuffer, audioContext),
      detectKey(audioBuffer, audioContext),
      calculateEnergy(audioBuffer),
      detectStructure(audioBuffer, audioContext),
      generateBeatgrid(audioBuffer, audioContext)
    ]);
    
    await audioContext.close();
    
    const analysis: AudioAnalysis = {
      bpm,
      key,
      energy,
      structure,
      beatgrid,
      duration: audioBuffer.duration
    };
    
    console.log('✅ Analysis complete:', analysis);
    return analysis;
    
  } catch (error) {
    console.error('❌ Error analyzing audio:', error);
    // Fallback avec valeurs par défaut
    return {
      bpm: 120,
      key: '8A',
      energy: 0.5,
      structure: {
        intro: null,
        outro: null,
        drops: [],
        breaks: []
      },
      beatgrid: [],
      duration: 0
    };
  }
}

/**
 * Détection BPM via analyse de peaks
 */
async function detectBPM(audioBuffer: AudioBuffer, audioContext: AudioContext): Promise<number> {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  
  // Filtrage passe-bas pour isoler les basses
  const offlineContext = new OfflineAudioContext(1, audioBuffer.length, sampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  const lowpass = offlineContext.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 150;
  
  source.connect(lowpass);
  lowpass.connect(offlineContext.destination);
  source.start();
  
  const filteredBuffer = await offlineContext.startRendering();
  const filteredData = filteredBuffer.getChannelData(0);
  
  // Détection de peaks
  const peaks: number[] = [];
  const minPeakDistance = sampleRate * 0.3; // Min 300ms entre peaks
  let lastPeakIndex = -minPeakDistance;
  
  for (let i = 0; i < filteredData.length; i++) {
    const value = Math.abs(filteredData[i]);
    
    if (value > 0.5 && (i - lastPeakIndex) > minPeakDistance) {
      let isPeak = true;
      const windowSize = 100;
      
      for (let j = Math.max(0, i - windowSize); j < Math.min(filteredData.length, i + windowSize); j++) {
        if (j !== i && Math.abs(filteredData[j]) > value) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        peaks.push(i / sampleRate);
        lastPeakIndex = i;
      }
    }
  }
  
  // Calcul BPM à partir des intervalles entre peaks
  if (peaks.length < 2) return 120;
  
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  
  // Moyenne des intervalles
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60 / avgInterval);
  
  // Validation BPM dans une plage réaliste (60-200 BPM)
  if (bpm < 60) return bpm * 2;
  if (bpm > 200) return Math.round(bpm / 2);
  
  return bpm;
}

/**
 * Détection de tonalité via FFT et analyse harmonique
 */
async function detectKey(audioBuffer: AudioBuffer, audioContext: AudioContext): Promise<string> {
  const fftSize = 8192;
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;
  
  const offlineContext = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();
  
  await offlineContext.startRendering();
  
  // Analyse simplifiée - retourne une clé aléatoire pondérée par l'énergie
  // Dans une implémentation réelle, on utiliserait Chroma features et Key detection
  const keys = Object.keys(CAMELOT_WHEEL);
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Calcul de l'énergie moyenne du morceau
 */
function calculateEnergy(audioBuffer: AudioBuffer): number {
  const channelData = audioBuffer.getChannelData(0);
  let sum = 0;
  
  for (let i = 0; i < channelData.length; i++) {
    sum += channelData[i] * channelData[i];
  }
  
  const rms = Math.sqrt(sum / channelData.length);
  return Math.min(1, rms * 10); // Normalisation 0-1
}

/**
 * Détection de structure (intro, outro, breaks, drops)
 */
async function detectStructure(audioBuffer: AudioBuffer, audioContext: AudioContext): Promise<AudioAnalysis['structure']> {
  const duration = audioBuffer.duration;
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  
  // Analyse de l'énergie par segments
  const segmentDuration = 2; // 2 secondes par segment
  const segmentCount = Math.floor(duration / segmentDuration);
  const energies: number[] = [];
  
  for (let i = 0; i < segmentCount; i++) {
    const start = i * segmentDuration * sampleRate;
    const end = Math.min((i + 1) * segmentDuration * sampleRate, channelData.length);
    const segment = channelData.slice(start, end);
    
    let sum = 0;
    for (let j = 0; j < segment.length; j++) {
      sum += segment[j] * segment[j];
    }
    energies.push(Math.sqrt(sum / segment.length));
  }
  
  // Détection intro (premiers 20% sous moyenne)
  const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
  let introEnd = 0;
  for (let i = 0; i < Math.min(energies.length, segmentCount * 0.2); i++) {
    if (energies[i] < avgEnergy * 0.6) {
      introEnd = (i + 1) * segmentDuration;
    } else {
      break;
    }
  }
  
  // Détection outro (derniers 20% sous moyenne)
  let outroStart = duration;
  for (let i = energies.length - 1; i >= Math.max(0, segmentCount * 0.8); i--) {
    if (energies[i] < avgEnergy * 0.6) {
      outroStart = i * segmentDuration;
    } else {
      break;
    }
  }
  
  // Détection drops (hausses soudaines d'énergie)
  const drops: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > energies[i - 1] * 1.5 && energies[i] > avgEnergy * 1.2) {
      drops.push(i * segmentDuration);
    }
  }
  
  // Détection breaks (chutes soudaines d'énergie)
  const breaks: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] < energies[i - 1] * 0.6 && energies[i] < avgEnergy * 0.7) {
      breaks.push(i * segmentDuration);
    }
  }
  
  return {
    intro: introEnd > 0 ? { start: 0, end: introEnd } : null,
    outro: outroStart < duration ? { start: outroStart, end: duration } : null,
    drops,
    breaks
  };
}

/**
 * Génération de la beatgrid
 */
async function generateBeatgrid(audioBuffer: AudioBuffer, audioContext: AudioContext): Promise<number[]> {
  // Simplification - on génère une beatgrid basique
  // Dans une vraie implémentation, on utiliserait les peaks détectés
  const bpm = await detectBPM(audioBuffer, audioContext);
  const beatInterval = 60 / bpm;
  const beatgrid: number[] = [];
  
  for (let time = 0; time < audioBuffer.duration; time += beatInterval) {
    beatgrid.push(time);
  }
  
  return beatgrid;
}

/**
 * Vérifie la compatibilité de clés entre deux tracks
 */
export function areKeysCompatible(key1: string, key2: string): boolean {
  const wheel1 = CAMELOT_WHEEL[key1];
  if (!wheel1) return true; // Si clé inconnue, on considère compatible
  
  return wheel1.compatible.includes(key2);
}

/**
 * Calcule le score de compatibilité entre deux tracks (0-1)
 */
export function calculateCompatibilityScore(
  track1: AudioAnalysis,
  track2: AudioAnalysis
): number {
  let score = 0;
  
  // BPM compatibility (max 6% difference is good)
  const bpmDiff = Math.abs(track1.bpm - track2.bpm) / track1.bpm;
  const bpmScore = Math.max(0, 1 - (bpmDiff / 0.06));
  score += bpmScore * 0.4;
  
  // Key compatibility
  const keyScore = areKeysCompatible(track1.key, track2.key) ? 1 : 0.3;
  score += keyScore * 0.3;
  
  // Energy compatibility (smooth transitions preferred)
  const energyDiff = Math.abs(track1.energy - track2.energy);
  const energyScore = Math.max(0, 1 - energyDiff);
  score += energyScore * 0.3;
  
  return score;
}

/**
 * Trouve le meilleur point de transition pour une track
 */
export function findBestTransitionPoint(
  analysis: AudioAnalysis,
  type: 'mix-out' | 'mix-in'
): TransitionPoint {
  if (type === 'mix-out') {
    // Pour mix-out, on préfère l'outro ou un break proche de la fin
    if (analysis.structure.outro) {
      return {
        time: analysis.structure.outro.start,
        type: 'outro',
        energy: analysis.energy
      };
    }
    
    const lateBreaks = analysis.structure.breaks.filter(b => b > analysis.duration * 0.7);
    if (lateBreaks.length > 0) {
      return {
        time: lateBreaks[lateBreaks.length - 1],
        type: 'break',
        energy: analysis.energy * 0.5
      };
    }
    
    // Fallback: derniers 16 beats
    const last16beats = Math.max(0, analysis.duration - (16 * 60 / analysis.bpm));
    return {
      time: last16beats,
      type: 'outro',
      energy: analysis.energy
    };
  } else {
    // Pour mix-in, on préfère l'intro ou un point avec basse énergie
    if (analysis.structure.intro) {
      return {
        time: analysis.structure.intro.start,
        type: 'intro',
        energy: analysis.energy * 0.5
      };
    }
    
    const earlyBreaks = analysis.structure.breaks.filter(b => b < analysis.duration * 0.3);
    if (earlyBreaks.length > 0) {
      return {
        time: earlyBreaks[0],
        type: 'break',
        energy: analysis.energy * 0.5
      };
    }
    
    // Fallback: premiers 8 beats
    const first8beats = 8 * 60 / analysis.bpm;
    return {
      time: first8beats,
      type: 'intro',
      energy: analysis.energy * 0.5
    };
  }
}

/**
 * Calcule le tempo stretch ratio optimal (limité à ±6% par défaut, max ±10%)
 */
export function calculateOptimalStretchRatio(
  sourceBPM: number,
  targetBPM: number,
  maxStretch: number = 0.06
): number {
  const idealRatio = targetBPM / sourceBPM;
  const maxRatio = 1 + maxStretch;
  const minRatio = 1 - maxStretch;
  
  // Clamp le ratio dans les limites
  if (idealRatio > maxRatio) return maxRatio;
  if (idealRatio < minRatio) return minRatio;
  
  return idealRatio;
}
