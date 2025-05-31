
import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EqualizerSettings, EqualizerPreset } from '@/types/equalizer';

interface AudioEqualizerProps {
  settings: EqualizerSettings;
  presets: EqualizerPreset[];
  currentPreset: string | null;
  isEnabled: boolean;
  isInitialized: boolean;
  onUpdateBand: (index: number, gain: number) => void;
  onApplyPreset: (presetName: string) => void;
  onToggleEnabled: () => void;
  onReset: () => void;
  onSetPreAmp: (gain: number) => void;
  onInitialize: () => void;
}

export const AudioEqualizer: React.FC<AudioEqualizerProps> = ({
  settings,
  presets,
  currentPreset,
  isEnabled,
  isInitialized,
  onUpdateBand,
  onApplyPreset,
  onToggleEnabled,
  onReset,
  onSetPreAmp,
  onInitialize
}) => {
  const formatFrequency = (freq: number): string => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)}k`;
    }
    return `${freq}`;
  };

  const formatGain = (gain: number): string => {
    return gain > 0 ? `+${gain}dB` : `${gain}dB`;
  };

  if (!isInitialized) {
    return (
      <Card className="p-6 bg-spotify-dark border-white/10">
        <div className="text-center">
          <Settings2 className="w-12 h-12 mx-auto mb-4 text-spotify-neutral" />
          <h3 className="text-lg font-medium text-white mb-2">Égaliseur Audio</h3>
          <p className="text-sm text-spotify-neutral mb-4">
            L'égaliseur n'est pas encore initialisé. Cliquez pour l'activer.
          </p>
          <Button onClick={onInitialize} className="bg-spotify-accent hover:bg-spotify-accent/80">
            Initialiser l'égaliseur
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-spotify-dark border-white/10 min-w-[400px]">
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Égaliseur Audio
          </h3>
          <div className="flex items-center gap-2">
            <Switch
              checked={isEnabled}
              onCheckedChange={onToggleEnabled}
              className="data-[state=checked]:bg-spotify-accent"
            />
            <span className="text-sm text-spotify-neutral">
              {isEnabled ? 'Activé' : 'Désactivé'}
            </span>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Presets</label>
          <div className="flex gap-2">
            <Select value={currentPreset || 'custom'} onValueChange={onApplyPreset}>
              <SelectTrigger className="flex-1 bg-spotify-dark border-white/20 text-white">
                <SelectValue placeholder="Sélectionner un preset" />
              </SelectTrigger>
              <SelectContent className="bg-spotify-dark border-white/20">
                {presets.map((preset) => (
                  <SelectItem 
                    key={preset.name} 
                    value={preset.name}
                    className="text-white hover:bg-white/10"
                  >
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={onReset}
              className="border-white/20 text-white hover:bg-white/10"
              title="Réinitialiser"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Préamplificateur */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-white">Préamplificateur</label>
            <span className="text-xs text-spotify-accent">
              {formatGain(settings.preAmp)}
            </span>
          </div>
          <Slider
            value={[settings.preAmp]}
            onValueChange={(value) => onSetPreAmp(value[0])}
            min={-12}
            max={12}
            step={0.5}
            className="w-full"
            disabled={!isEnabled}
          />
        </div>

        {/* Bandes de fréquence */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-white">Bandes de fréquence</label>
          
          <div className="flex justify-between items-end gap-3 h-48">
            {settings.bands.map((band, index) => (
              <div key={index} className="flex flex-col items-center gap-2 flex-1">
                {/* Valeur du gain */}
                <div className="text-xs text-spotify-accent min-h-[16px]">
                  {isEnabled ? formatGain(band.gain) : '0dB'}
                </div>
                
                {/* Slider vertical */}
                <div className="h-32 flex items-center">
                  <Slider
                    value={[band.gain]}
                    onValueChange={(value) => onUpdateBand(index, value[0])}
                    min={-12}
                    max={12}
                    step={0.5}
                    orientation="vertical"
                    className={cn(
                      "h-32 w-6",
                      !isEnabled && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={!isEnabled}
                  />
                </div>
                
                {/* Étiquette de fréquence */}
                <div className="text-xs text-spotify-neutral text-center">
                  {formatFrequency(band.frequency)}Hz
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Indicateurs visuels */}
        <div className="border-t border-white/10 pt-4">
          <div className="text-xs text-spotify-neutral text-center">
            {!isEnabled && "Égaliseur désactivé"}
            {isEnabled && !currentPreset && "Réglages personnalisés"}
            {isEnabled && currentPreset && `Preset: ${currentPreset}`}
          </div>
        </div>
      </div>
    </Card>
  );
};
