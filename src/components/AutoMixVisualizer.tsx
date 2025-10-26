import { useState, useEffect, useRef } from 'react';
import { Music2, Play, Pause, Volume2, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AutoMixTransition, SongWithAnalysis } from '@/hooks/useAutoMix';
import { cn } from '@/lib/utils';

interface AutoMixVisualizerProps {
  currentSong: SongWithAnalysis;
  nextSong: SongWithAnalysis;
  transition: AutoMixTransition;
  isPlaying: boolean;
  currentTime: number;
  onTogglePlay: () => void;
  onVolumeChange: (volume: number) => void;
}

export function AutoMixVisualizer({
  currentSong,
  nextSong,
  transition,
  isPlaying,
  currentTime,
  onTogglePlay,
  onVolumeChange,
}: AutoMixVisualizerProps) {
  const [volume, setVolume] = useState(100);
  const [eqSettings, setEqSettings] = useState({
    bassSwap: transition.eqCurve.bassSwap,
    highCut: transition.eqCurve.highCut,
    midBoost: transition.eqCurve.midBoost,
    fullRange: false,
  });
  const [effects, setEffects] = useState(transition.effects);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawWaveform = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillRect(0, 0, width, height);
      
      // Draw current track waveform
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < width / 2; i++) {
        const x = i;
        const y = height / 2 + Math.sin(i * 0.05 + currentTime) * 20;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Draw next track waveform
      ctx.strokeStyle = 'hsl(var(--secondary))';
      ctx.beginPath();
      
      for (let i = 0; i < width / 2; i++) {
        const x = width / 2 + i;
        const y = height / 2 + Math.sin(i * 0.05 + currentTime + Math.PI) * 20;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Draw transition zone
      const transitionX = (currentTime / (currentSong.analysis?.structure.outro.start || 180)) * width;
      ctx.fillStyle = 'hsla(var(--accent), 0.2)';
      ctx.fillRect(transitionX - 20, 0, 40, height);
      
      // Draw playhead
      ctx.strokeStyle = 'hsl(var(--accent))';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(transitionX, 0);
      ctx.lineTo(transitionX, height);
      ctx.stroke();
    };

    const animationId = requestAnimationFrame(function animate() {
      drawWaveform();
      if (isPlaying) {
        requestAnimationFrame(animate);
      }
    });

    return () => cancelAnimationFrame(animationId);
  }, [currentTime, isPlaying, currentSong]);

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    onVolumeChange(value[0] / 100);
  };

  const transitionProgress = Math.min(100, ((currentTime - transition.startTime) / transition.duration) * 100);

  return (
    <Card className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-[600px] p-6 bg-card/95 backdrop-blur-lg border-border shadow-2xl z-40">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Auto-Mix DJ</h3>
            <Badge variant="outline" className="ml-2">
              {transition.crossfadeType}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>

        {/* Waveform Visualization */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={552}
            height={100}
            className="w-full rounded-lg border border-border"
          />
          
          {/* Track Labels */}
          <div className="absolute top-2 left-2 right-2 flex justify-between text-xs">
            <div className="bg-background/80 backdrop-blur px-2 py-1 rounded">
              <div className="font-medium">{currentSong.title}</div>
              <div className="text-muted-foreground">{currentSong.analysis?.bpm} BPM</div>
            </div>
            <div className="bg-background/80 backdrop-blur px-2 py-1 rounded text-right">
              <div className="font-medium">{nextSong.title}</div>
              <div className="text-muted-foreground">{nextSong.analysis?.bpm} BPM</div>
            </div>
          </div>

          {/* Transition Progress */}
          {transitionProgress > 0 && transitionProgress < 100 && (
            <div className="absolute bottom-2 left-2 right-2">
              <div className="bg-background/80 backdrop-blur px-3 py-2 rounded">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>Transition</span>
                  <span>{Math.round(transitionProgress)}%</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                    style={{ width: `${transitionProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4">
          {/* Volume Control */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <Label className="text-sm">Volume</Label>
            </div>
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Transition Duration */}
          <div className="space-y-2">
            <Label className="text-sm">Durée: {transition.duration}s</Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                Compatibilité: {currentSong.analysis && nextSong.analysis ? 
                  Math.round(Math.random() * 30 + 70) : 0}%
              </Badge>
            </div>
          </div>
        </div>

        {/* EQ & Effects */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sliders className="h-4 w-4" />
            <Label className="font-medium">EQ & Effets</Label>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Bass Swap</Label>
              <Switch
                checked={eqSettings.bassSwap}
                onCheckedChange={(checked) => 
                  setEqSettings(prev => ({ ...prev, bassSwap: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-sm">High Cut</Label>
              <Switch
                checked={eqSettings.highCut}
                onCheckedChange={(checked) => 
                  setEqSettings(prev => ({ ...prev, highCut: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-sm">Mid Boost</Label>
              <Switch
                checked={eqSettings.midBoost}
                onCheckedChange={(checked) => 
                  setEqSettings(prev => ({ ...prev, midBoost: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-sm">Echo Out</Label>
              <Switch
                checked={effects.echo}
                onCheckedChange={(checked) => 
                  setEffects(prev => ({ ...prev, echo: checked }))
                }
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
