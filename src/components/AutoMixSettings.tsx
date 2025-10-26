import { useState } from 'react';
import { Music2, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { MixMode } from '@/hooks/useAutoMix';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';

export function AutoMixSettings() {
  const { autoMixConfig, updateAutoMixConfig, toggleAutoMix, autoMixAnalyzing } = usePlayer();
  const [isOpen, setIsOpen] = useState(false);

  const modes: { value: MixMode; label: string; description: string; emoji: string }[] = [
    { value: 'fluide', label: 'Fluide', description: 'Transitions douces et longues', emoji: '🌊' },
    { value: 'club', label: 'Club', description: 'Mix rythmique avec effets', emoji: '🎛️' },
    { value: 'radio', label: 'Radio', description: 'Enchaînements naturels', emoji: '📻' },
    { value: 'energie', label: 'Énergie', description: 'Transitions dynamiques', emoji: '⚡' },
  ];

  const handleModeChange = (mode: MixMode) => {
    const modeConfig = {
      fluide: { transitionDuration: 10, effectsEnabled: true, eqEnabled: true },
      club: { transitionDuration: 6, effectsEnabled: true, eqEnabled: true },
      radio: { transitionDuration: 4, effectsEnabled: false, eqEnabled: false },
      energie: { transitionDuration: 8, effectsEnabled: true, eqEnabled: true },
    };
    
    updateAutoMixConfig({
      mode,
      ...modeConfig[mode],
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={autoMixConfig?.enabled ? "default" : "outline"}
          className={cn(
            "gap-2 transition-all duration-300",
            autoMixConfig?.enabled && "bg-gradient-to-r from-primary to-accent hover:opacity-90 animate-pulse"
          )}
        >
          <Music2 className="h-4 w-4" />
          Auto-Mix DJ
          {autoMixConfig?.enabled && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0">
              ON
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Configuration Auto-Mix
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Activer Auto-Mix</Label>
              <p className="text-sm text-muted-foreground">
                Transitions automatiques entre morceaux
              </p>
            </div>
            <Switch
              checked={autoMixConfig?.enabled || false}
              onCheckedChange={toggleAutoMix}
              disabled={autoMixAnalyzing}
            />
          </div>

          {autoMixConfig?.enabled && (
            <>
              {/* Mix Mode */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Style de Mix
                </Label>
                <Select value={autoMixConfig.mode} onValueChange={handleModeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        <div className="flex items-center gap-2">
                          <span>{mode.emoji}</span>
                          <div>
                            <div className="font-medium">{mode.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {mode.description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transition Duration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Durée de transition</Label>
                  <span className="text-sm font-medium">{autoMixConfig.transitionDuration}s</span>
                </div>
                <Slider
                  value={[autoMixConfig.transitionDuration]}
                  onValueChange={([value]) => updateAutoMixConfig({ transitionDuration: value })}
                  min={4}
                  max={12}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Entre 4 et 12 secondes pour un mix naturel
                </p>
              </div>

              {/* Advanced Options */}
              <div className="space-y-3 pt-3 border-t">
                <Label className="text-sm font-medium">Options avancées</Label>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Tempo Stretch</Label>
                    <p className="text-xs text-muted-foreground">
                      Ajustement automatique du BPM (±6%)
                    </p>
                  </div>
                  <Switch
                    checked={autoMixConfig.tempoStretch}
                    onCheckedChange={(checked) => updateAutoMixConfig({ tempoStretch: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Égalisation (EQ)</Label>
                    <p className="text-xs text-muted-foreground">
                      Filtres basses/aigus pendant transition
                    </p>
                  </div>
                  <Switch
                    checked={autoMixConfig.eqEnabled}
                    onCheckedChange={(checked) => updateAutoMixConfig({ eqEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Effets audio</Label>
                    <p className="text-xs text-muted-foreground">
                      Écho, reverb pendant les transitions
                    </p>
                  </div>
                  <Switch
                    checked={autoMixConfig.effectsEnabled}
                    onCheckedChange={(checked) => updateAutoMixConfig({ effectsEnabled: checked })}
                  />
                </div>
              </div>

              {/* Info */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">
                  💡 L'analyse automatique détecte le BPM, la tonalité et la structure 
                  de chaque morceau pour créer des transitions professionnelles.
                </p>
              </div>
            </>
          )}

          {autoMixAnalyzing && (
            <div className="text-center py-4">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Analyse en cours...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
