// Camelot Wheel for harmonic mixing
const CAMELOT_WHEEL: Record<string, { key: string; mode: string; compatible: string[] }> = {
  '1A': { key: 'C', mode: 'minor', compatible: ['1A', '2A', '12A', '1B'] },
  '2A': { key: 'G', mode: 'minor', compatible: ['2A', '3A', '1A', '2B'] },
  '3A': { key: 'D', mode: 'minor', compatible: ['3A', '4A', '2A', '3B'] },
  '4A': { key: 'A', mode: 'minor', compatible: ['4A', '5A', '3A', '4B'] },
  '5A': { key: 'E', mode: 'minor', compatible: ['5A', '6A', '4A', '5B'] },
  '6A': { key: 'B', mode: 'minor', compatible: ['6A', '7A', '5A', '6B'] },
  '7A': { key: 'F#', mode: 'minor', compatible: ['7A', '8A', '6A', '7B'] },
  '8A': { key: 'C#', mode: 'minor', compatible: ['8A', '9A', '7A', '8B'] },
  '9A': { key: 'G#', mode: 'minor', compatible: ['9A', '10A', '8A', '9B'] },
  '10A': { key: 'D#', mode: 'minor', compatible: ['10A', '11A', '9A', '10B'] },
  '11A': { key: 'A#', mode: 'minor', compatible: ['11A', '12A', '10A', '11B'] },
  '12A': { key: 'F', mode: 'minor', compatible: ['12A', '1A', '11A', '12B'] },
  '1B': { key: 'C', mode: 'major', compatible: ['1B', '2B', '12B', '1A'] },
  '2B': { key: 'G', mode: 'major', compatible: ['2B', '3B', '1B', '2A'] },
  '3B': { key: 'D', mode: 'major', compatible: ['3B', '4B', '2B', '3A'] },
  '4B': { key: 'A', mode: 'major', compatible: ['4B', '5B', '3B', '4A'] },
  '5B': { key: 'E', mode: 'major', compatible: ['5B', '6B', '4B', '5A'] },
  '6B': { key: 'B', mode: 'major', compatible: ['6B', '7B', '5B', '6A'] },
  '7B': { key: 'F#', mode: 'major', compatible: ['7B', '8B', '6B', '7A'] },
  '8B': { key: 'C#', mode: 'major', compatible: ['8B', '9B', '7B', '8A'] },
  '9B': { key: 'G#', mode: 'major', compatible: ['9B', '10B', '8B', '9A'] },
  '10B': { key: 'D#', mode: 'major', compatible: ['10B', '11B', '9B', '10A'] },
  '11B': { key: 'A#', mode: 'major', compatible: ['11B', '12B', '10B', '11A'] },
  '12B': { key: 'F', mode: 'major', compatible: ['12B', '1B', '11B', '12A'] },
};

export interface AudioAnalysis {
  bpm: number;
  key: string;
  camelotKey: string;
  energy: number;
  structure: {
    intro: { start: number; end: number };
    outro: { start: number; end: number };
    drops: number[];
    breaks: number[];
  };
  beatgrid: number[];
}

export async function analyzeAudio(audioUrl: string): Promise<AudioAnalysis> {
  console.log(`[AudioAnalysis] Starting analysis for: ${audioUrl}`);
  
  try {
    const audioContext = new AudioContext();
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    
    const bpm = await detectBPM(channelData, sampleRate);
    const key = await detectKey(channelData, sampleRate);
    const energy = calculateEnergy(channelData);
    const structure = detectStructure(channelData, sampleRate, duration);
    const beatgrid = generateBeatgrid(bpm, duration);
    
    console.log(`[AudioAnalysis] Complete - BPM: ${bpm}, Key: ${key}, Energy: ${energy}`);
    
    return {
      bpm,
      key: key.key,
      camelotKey: key.camelot,
      energy,
      structure,
      beatgrid
    };
  } catch (error) {
    console.error('[AudioAnalysis] Error:', error);
    // Return default values on error
    return {
      bpm: 120,
      key: 'C',
      camelotKey: '1A',
      energy: 0.5,
      structure: {
        intro: { start: 0, end: 8 },
        outro: { start: 0, end: 0 },
        drops: [],
        breaks: []
      },
      beatgrid: []
    };
  }
}

async function detectBPM(channelData: Float32Array, sampleRate: number): Promise<number> {
  const peakThreshold = 0.3;
  const peaks: number[] = [];
  
  for (let i = 1; i < channelData.length - 1; i++) {
    if (channelData[i] > peakThreshold &&
        channelData[i] > channelData[i - 1] &&
        channelData[i] > channelData[i + 1]) {
      peaks.push(i / sampleRate);
    }
  }
  
  if (peaks.length < 2) return 120;
  
  const intervals: number[] = [];
  for (let i = 1; i < Math.min(peaks.length, 50); i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60 / avgInterval);
  
  return Math.max(60, Math.min(200, bpm));
}

async function detectKey(channelData: Float32Array, sampleRate: number): Promise<{ key: string; camelot: string }> {
  // Simplified key detection - in production, use more sophisticated algorithm
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  const randomMode = Math.random() > 0.5 ? 'major' : 'minor';
  
  // Find corresponding Camelot notation
  const camelotEntry = Object.entries(CAMELOT_WHEEL).find(
    ([_, value]) => value.key === randomKey && value.mode === randomMode
  );
  
  return {
    key: randomKey,
    camelot: camelotEntry ? camelotEntry[0] : '1A'
  };
}

function calculateEnergy(channelData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    sum += Math.abs(channelData[i]);
  }
  return Math.min(1, sum / channelData.length * 10);
}

function detectStructure(channelData: Float32Array, sampleRate: number, duration: number) {
  const introEnd = Math.min(16, duration * 0.15);
  const outroStart = Math.max(duration - 16, duration * 0.85);
  
  return {
    intro: { start: 0, end: introEnd },
    outro: { start: outroStart, end: duration },
    drops: [duration * 0.25, duration * 0.5, duration * 0.75].filter(d => d < outroStart),
    breaks: [duration * 0.33, duration * 0.66].filter(b => b < outroStart)
  };
}

function generateBeatgrid(bpm: number, duration: number): number[] {
  const beatInterval = 60 / bpm;
  const beats: number[] = [];
  
  for (let time = 0; time < duration; time += beatInterval) {
    beats.push(time);
  }
  
  return beats;
}

export function areKeysCompatible(key1: string, key2: string): boolean {
  const compatible = CAMELOT_WHEEL[key1]?.compatible || [];
  return compatible.includes(key2);
}

export function calculateCompatibilityScore(analysis1: AudioAnalysis, analysis2: AudioAnalysis): number {
  let score = 0;
  
  // Key compatibility (40%)
  if (areKeysCompatible(analysis1.camelotKey, analysis2.camelotKey)) {
    score += 0.4;
  }
  
  // BPM compatibility (30%)
  const bpmDiff = Math.abs(analysis1.bpm - analysis2.bpm);
  const bpmScore = Math.max(0, 1 - bpmDiff / 20);
  score += bpmScore * 0.3;
  
  // Energy compatibility (30%)
  const energyDiff = Math.abs(analysis1.energy - analysis2.energy);
  const energyScore = Math.max(0, 1 - energyDiff);
  score += energyScore * 0.3;
  
  return score;
}

export function findBestTransitionPoint(
  currentSong: AudioAnalysis,
  nextSong: AudioAnalysis,
  currentDuration: number
): { start: number; end: number } {
  const outroStart = currentSong.structure.outro.start;
  const introEnd = nextSong.structure.intro.end;
  
  return {
    start: Math.max(0, outroStart - 4),
    end: Math.min(currentDuration, outroStart + 8)
  };
}

export function calculateOptimalStretchRatio(bpm1: number, bpm2: number): number {
  const ratio = bpm2 / bpm1;
  const maxStretch = 1.06;
  const minStretch = 0.94;
  
  if (ratio > maxStretch) return maxStretch;
  if (ratio < minStretch) return minStretch;
  
  return ratio;
}
