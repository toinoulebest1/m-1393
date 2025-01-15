import React, { useEffect, useState } from 'react';
import { Slider } from "@/components/ui/slider";

interface EqualizerProps {
  audioContext: AudioContext;
  sourceNode: MediaElementAudioSourceNode;
}

const BANDS = [
  { frequency: 60, label: '60Hz' },
  { frequency: 170, label: '170Hz' },
  { frequency: 310, label: '310Hz' },
  { frequency: 600, label: '600Hz' },
  { frequency: 1000, label: '1kHz' },
  { frequency: 3000, label: '3kHz' },
  { frequency: 6000, label: '6kHz' },
  { frequency: 12000, label: '12kHz' },
  { frequency: 14000, label: '14kHz' },
  { frequency: 16000, label: '16kHz' },
];

export const Equalizer = ({ audioContext, sourceNode }: EqualizerProps) => {
  const [filters, setFilters] = useState<BiquadFilterNode[]>([]);
  const [gains, setGains] = useState<number[]>(new Array(BANDS.length).fill(0));

  useEffect(() => {
    // Création des filtres
    const newFilters = BANDS.map(({ frequency }) => {
      const filter = audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = frequency;
      filter.Q.value = 1;
      filter.gain.value = 0;
      return filter;
    });

    // Connexion des filtres en série
    sourceNode.disconnect();
    let prevNode: AudioNode = sourceNode;
    newFilters.forEach((filter) => {
      prevNode.connect(filter);
      prevNode = filter;
    });
    newFilters[newFilters.length - 1].connect(audioContext.destination);

    setFilters(newFilters);

    return () => {
      newFilters.forEach(filter => filter.disconnect());
      sourceNode.disconnect();
    };
  }, [audioContext, sourceNode]);

  const handleGainChange = (index: number, value: number[]) => {
    const newGains = [...gains];
    newGains[index] = value[0];
    setGains(newGains);

    if (filters[index]) {
      filters[index].gain.value = value[0];
    }
  };

  return (
    <div className="grid grid-cols-10 gap-2 px-4 py-2 bg-black/20 rounded-lg">
      {BANDS.map((band, index) => (
        <div key={band.frequency} className="flex flex-col items-center space-y-2">
          <Slider
            orientation="vertical"
            value={[gains[index]]}
            min={-12}
            max={12}
            step={0.1}
            className="h-24"
            onValueChange={(value) => handleGainChange(index, value)}
          />
          <span className="text-xs text-spotify-neutral">{band.label}</span>
        </div>
      ))}
    </div>
  );
};