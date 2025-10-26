import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Music2, Settings, Zap, Volume2 } from 'lucide-react';
import { AutoMixConfig } from '@/hooks/useAutoMix';
import { cn } from '@/lib/utils';

interface AutoMixSettingsProps {
  config: AutoMixConfig;
  isAnalyzing: boolean;
  analysisProgress: number;
  onToggle: (enabled: boolean) => void;
  onConfigChange: (updates: Partial<AutoMixConfig>) => void;
  onAnalyzePlaylist?: () => void;
}

export const AutoMixSettings = ({
  config,
  isAnalyzing,
  analysisProgress,
  onToggle,
  onConfigChange,
  onAnalyzePlaylist
}: AutoMixSettingsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={config.enabled ? "default" : "outline"}
          size="sm"
          className={cn(
            "gap-2 transition-all",
            config.enabled && "bg-gradient-to-r from-primary to-primary/80"
          )}
        >
          <Music2 className="h-4 w-4" />
          Auto-Mix DJ
          {config.enabled && <Zap className="h-3 w-3 animate-pulse" />}
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
              <Label className="text-base font-medium">Enable Auto-Mix</Label>
              <p className="text-sm text-muted-foreground">
                Automatic DJ mixing with intelligent transitions
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={onToggle}
            />
          </div>

          {/* Analyze Playlist Button */}
          {onAnalyzePlaylist && (
            <div className="space-y-2">
              <Button
                onClick={onAnalyzePlaylist}
                disabled={isAnalyzing || !config.enabled}
                className="w-full"
                variant="secondary"
              >
                {isAnalyzing ? (
                  <>
                    <Settings className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing... {Math.round(analysisProgress)}%
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Analyze Playlist
                  </>
                )}
              </Button>
              {isAnalyzing && (
                <Progress value={analysisProgress} className="h-2" />
              )}
            </div>
          )}

          <div className="h-px bg-border" />

          {/* Transition Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Transition Duration</Label>
              <span className="text-sm text-muted-foreground">
                {config.transitionDuration}s
              </span>
            </div>
            <Slider
              value={[config.transitionDuration]}
              onValueChange={([value]) => onConfigChange({ transitionDuration: value })}
              min={4}
              max={32}
              step={2}
              disabled={!config.enabled}
            />
            <p className="text-xs text-muted-foreground">
              8-32 beats transition length
            </p>
          </div>

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
          <p className="text-xs text-muted-foreground">
            Intelligent mixing with BPM, key, and energy matching
          </p>
          <Button onClick={() => setOpen(false)} size="sm">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
