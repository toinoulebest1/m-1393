import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Music2, Settings, Zap, Volume2, Waves, Radio, Sparkles, Flame } from 'lucide-react';
import { AutoMixConfig, MixMode } from '@/hooks/useAutoMix';
import { cn } from '@/lib/utils';

interface AutoMixSettingsProps {
  config: AutoMixConfig;
  isAnalyzing: boolean;
  analysisProgress: number;
  onToggle: (enabled: boolean) => void;
  onModeChange: (mode: MixMode) => void;
  onConfigChange: (updates: Partial<AutoMixConfig>) => void;
  onAnalyzePlaylist?: () => void;
}

const MIX_MODES: Array<{
  id: MixMode;
  label: string;
  description: string;
  icon: any;
  color: string;
}> = [
  {
    id: 'fluide',
    label: '🎚️ Fluide',
    description: 'Fondu doux, parfait pour chill ou pop',
    icon: Waves,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'club',
    label: '💥 Club',
    description: 'Mix rythmique avec effets, idéal pour electro/house',
    icon: Zap,
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'radio',
    label: '🎶 Radio',
    description: 'Enchaînement naturel comme une playlist radio',
    icon: Radio,
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'energie',
    label: '⚡ Énergie',
    description: 'Enchaînements dynamiques pour ambiance de fête',
    icon: Flame,
    color: 'from-orange-500 to-red-500'
  }
];

export const AutoMixSettings = ({
  config,
  isAnalyzing,
  analysisProgress,
  onToggle,
  onModeChange,
  onConfigChange,
  onAnalyzePlaylist
}: AutoMixSettingsProps) => {
  const [open, setOpen] = useState(false);
  const currentMode = MIX_MODES.find(m => m.id === config.mode) || MIX_MODES[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={config.enabled ? "default" : "outline"}
          size="sm"
          className={cn(
            "gap-2 transition-all relative group",
            config.enabled && "bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25"
          )}
        >
          <Music2 className="h-4 w-4" />
          <span className="font-medium">Auto-Mix DJ</span>
          {config.enabled && (
            <>
              <Zap className="h-3 w-3 animate-pulse text-yellow-300" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
            </>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Auto-Mix DJ Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Activer Auto-Mix DJ</Label>
              <p className="text-sm text-muted-foreground">
                Mixage DJ automatique avec transitions intelligentes
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={onToggle}
            />
          </div>

          {/* Mix Mode Selection */}
          {config.enabled && (
            <div className="space-y-3">
              <Label className="text-base">Mode de Mix</Label>
              <div className="grid grid-cols-2 gap-2">
                {MIX_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = config.mode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => onModeChange(mode.id)}
                      className={cn(
                        "relative p-4 rounded-lg border-2 transition-all text-left group",
                        isActive
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 bg-background"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          isActive ? `bg-gradient-to-br ${mode.color}` : "bg-muted"
                        )}>
                          <Icon className={cn(
                            "h-4 w-4",
                            isActive ? "text-white" : "text-muted-foreground"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "font-medium text-sm mb-1",
                            isActive ? "text-primary" : "text-foreground"
                          )}>
                            {mode.label}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {mode.description}
                          </p>
                        </div>
                      </div>
                      {isActive && (
                        <div className="absolute top-2 right-2">
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Analyze Playlist Button */}
          {onAnalyzePlaylist && config.enabled && (
            <div className="space-y-2">
              <Button
                onClick={onAnalyzePlaylist}
                disabled={isAnalyzing}
                className="w-full"
                variant="secondary"
              >
                {isAnalyzing ? (
                  <>
                    <Settings className="mr-2 h-4 w-4 animate-spin" />
                    Analyse en cours... {Math.round(analysisProgress)}%
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyser la Playlist
                  </>
                )}
              </Button>
              {isAnalyzing && (
                <Progress value={analysisProgress} className="h-2" />
              )}
              <p className="text-xs text-muted-foreground text-center">
                ✨ Gratuit • Sans limite • Accessible à tous
              </p>
            </div>
          )}

          <div className="h-px bg-border" />

          {/* Transition Duration */}
          {config.enabled && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Durée de transition</Label>
                <span className="text-sm text-muted-foreground">
                  {config.transitionDuration}s
                </span>
              </div>
              <Slider
                value={[config.transitionDuration]}
                onValueChange={([value]) => onConfigChange({ transitionDuration: value })}
                min={2}
                max={12}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Entre 2 et 12 secondes selon le mode
              </p>
            </div>
          )}

          {/* Max Stretch */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Max Tempo Stretch</Label>
              <span className="text-sm text-muted-foreground">
                ±{Math.round(config.maxStretch * 100)}%
              </span>
            </div>
            <Slider
              value={[config.maxStretch * 100]}
              onValueChange={([value]) => onConfigChange({ maxStretch: value / 100 })}
              min={0}
              max={10}
              step={1}
              disabled={!config.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Time-stretch without pitch shift (safe: ±6%, max: ±10%)
            </p>
          </div>

          {/* Target LUFS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Target Loudness (LUFS)
              </Label>
              <span className="text-sm text-muted-foreground">
                {config.targetLUFS} dB
              </span>
            </div>
            <Slider
              value={[Math.abs(config.targetLUFS)]}
              onValueChange={([value]) => onConfigChange({ targetLUFS: -value })}
              min={8}
              max={20}
              step={1}
              disabled={!config.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Normalize volume for consistent playback (-14 LUFS recommended)
            </p>
          </div>

          <div className="h-px bg-border" />

          {/* Effects */}
          <div className="space-y-4">
            <Label className="text-base">Transition Effects</Label>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-normal">EQ Sweep</Label>
                <p className="text-xs text-muted-foreground">
                  Progressive high-frequency cut
                </p>
              </div>
              <Switch
                checked={config.eqSweepEnabled}
                onCheckedChange={(checked) => onConfigChange({ eqSweepEnabled: checked })}
                disabled={!config.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-normal">Lowpass Filter</Label>
                <p className="text-xs text-muted-foreground">
                  Smooth frequency transition
                </p>
              </div>
              <Switch
                checked={config.filterEnabled}
                onCheckedChange={(checked) => onConfigChange({ filterEnabled: checked })}
                disabled={!config.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-normal">Echo Out</Label>
                <p className="text-xs text-muted-foreground">
                  Add echo effect on outro transitions
                </p>
              </div>
              <Switch
                checked={config.echoOutEnabled}
                onCheckedChange={(checked) => onConfigChange({ echoOutEnabled: checked })}
                disabled={!config.enabled}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground mb-1">
              🎵 Mix comme un DJ professionnel
            </p>
            <p className="text-xs text-muted-foreground">
              BPM sync • Harmonic mixing • Smart transitions
            </p>
          </div>
          <Button onClick={() => setOpen(false)} size="sm">
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
