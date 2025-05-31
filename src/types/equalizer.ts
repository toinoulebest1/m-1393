
export interface EqualizerBand {
  frequency: number;
  gain: number;
  type: BiquadFilterType;
  Q?: number;
}

export interface EqualizerSettings {
  bands: EqualizerBand[];
  enabled: boolean;
  preAmp: number;
}

export interface EqualizerPreset {
  name: string;
  settings: EqualizerSettings;
}

export interface EqualizerContextType {
  settings: EqualizerSettings;
  presets: EqualizerPreset[];
  currentPreset: string | null;
  isEnabled: boolean;
  updateBand: (index: number, gain: number) => void;
  applyPreset: (presetName: string) => void;
  toggleEnabled: () => void;
  resetEqualizer: () => void;
  setPreAmp: (gain: number) => void;
}

// Presets par défaut - maintenant avec preAmp: -15 pour tous les presets
export const DEFAULT_PRESETS: EqualizerPreset[] = [
  {
    name: "Flat",
    settings: {
      bands: [
        { frequency: 60, gain: 0, type: "peaking" },
        { frequency: 170, gain: 0, type: "peaking" },
        { frequency: 350, gain: 0, type: "peaking" },
        { frequency: 1000, gain: 0, type: "peaking" },
        { frequency: 3500, gain: 0, type: "peaking" },
        { frequency: 10000, gain: 0, type: "peaking" }
      ],
      enabled: true,
      preAmp: -15
    }
  },
  {
    name: "Rock",
    settings: {
      bands: [
        { frequency: 60, gain: 5, type: "peaking" },
        { frequency: 170, gain: 3, type: "peaking" },
        { frequency: 350, gain: -2, type: "peaking" },
        { frequency: 1000, gain: 2, type: "peaking" },
        { frequency: 3500, gain: 4, type: "peaking" },
        { frequency: 10000, gain: 6, type: "peaking" }
      ],
      enabled: true,
      preAmp: -15
    }
  },
  {
    name: "Pop",
    settings: {
      bands: [
        { frequency: 60, gain: -1, type: "peaking" },
        { frequency: 170, gain: 2, type: "peaking" },
        { frequency: 350, gain: 4, type: "peaking" },
        { frequency: 1000, gain: 3, type: "peaking" },
        { frequency: 3500, gain: 1, type: "peaking" },
        { frequency: 10000, gain: 2, type: "peaking" }
      ],
      enabled: true,
      preAmp: -15
    }
  },
  {
    name: "Jazz",
    settings: {
      bands: [
        { frequency: 60, gain: 3, type: "peaking" },
        { frequency: 170, gain: 2, type: "peaking" },
        { frequency: 350, gain: 1, type: "peaking" },
        { frequency: 1000, gain: 2, type: "peaking" },
        { frequency: 3500, gain: 3, type: "peaking" },
        { frequency: 10000, gain: 4, type: "peaking" }
      ],
      enabled: true,
      preAmp: -15
    }
  },
  {
    name: "Classical",
    settings: {
      bands: [
        { frequency: 60, gain: 2, type: "peaking" },
        { frequency: 170, gain: 1, type: "peaking" },
        { frequency: 350, gain: -1, type: "peaking" },
        { frequency: 1000, gain: 1, type: "peaking" },
        { frequency: 3500, gain: 3, type: "peaking" },
        { frequency: 10000, gain: 4, type: "peaking" }
      ],
      enabled: true,
      preAmp: -15
    }
  },
  {
    name: "Electronic",
    settings: {
      bands: [
        { frequency: 60, gain: 6, type: "peaking" },
        { frequency: 170, gain: 4, type: "peaking" },
        { frequency: 350, gain: 1, type: "peaking" },
        { frequency: 1000, gain: -1, type: "peaking" },
        { frequency: 3500, gain: 2, type: "peaking" },
        { frequency: 10000, gain: 5, type: "peaking" }
      ],
      enabled: true,
      preAmp: -15
    }
  }
];
