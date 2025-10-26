import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Song } from '@/types/player';
import { AutoMixTransition } from '@/hooks/useAutoMix';

interface AutoMixVisualizerProps {
  currentSong: Song;
  nextSong: Song;
  transition: AutoMixTransition;
  isPlaying: boolean;
  currentTime: number;
  onPlayPause: () => void;
  onTransitionTypeChange: (type: 'auto' | 'fade' | 'rise' | 'blend') => void;
  onVolumeOverlapChange: (value: number) => void;
  onEqChange: (value: string) => void;
  onEffectChange: (value: string) => void;
}

export const AutoMixVisualizer = ({
  currentSong,
  nextSong,
  transition,
  isPlaying,
  currentTime,
  onPlayPause,
  onTransitionTypeChange,
  onVolumeOverlapChange,
  onEqChange,
  onEffectChange
}: AutoMixVisualizerProps) => {
  const currentWaveformRef = useRef<HTMLCanvasElement>(null);
  const nextWaveformRef = useRef<HTMLCanvasElement>(null);
  const [transitionType, setTransitionType] = useState<'auto' | 'fade' | 'rise' | 'blend'>('auto');
  const [volumeOverlap, setVolumeOverlap] = useState(50);
  const [eqSetting, setEqSetting] = useState('End bass swap');
  const [effectSetting, setEffectSetting] = useState('Low pass');

  // Génère une forme d'onde simplifiée
  const generateWaveform = (canvas: HTMLCanvasElement, color: string, alpha: number = 1) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;

    // Génère des barres aléatoires pour simuler une forme d'onde
    const barWidth = 2;
    const gap = 1;
    const numBars = Math.floor(width / (barWidth + gap));

    for (let i = 0; i < numBars; i++) {
      const x = i * (barWidth + gap);
      const barHeight = Math.random() * (height * 0.8);
      const y = centerY - barHeight / 2;

      ctx.fillRect(x, y, barWidth, barHeight);
    }

    ctx.globalAlpha = 1;
  };

  // Dessine la zone de transition
  const drawTransitionZone = () => {
    const canvas = currentWaveformRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Zone de transition (rectangle semi-transparent)
    const transitionStartX = canvas.width * 0.6; // 60% de la largeur
    const transitionWidth = canvas.width * 0.2; // 20% de largeur pour la transition

    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Bleu semi-transparent
    ctx.fillRect(transitionStartX, 0, transitionWidth, canvas.height);

    // Bordures de la zone de transition
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(transitionStartX, 0, transitionWidth, canvas.height);

    // Indicateur de position actuelle (ligne verticale)
    const currentX = (currentTime / (currentSong.duration ? parseFloat(currentSong.duration.split(':')[0]) * 60 : 180)) * canvas.width;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, 0);
    ctx.lineTo(currentX, canvas.height);
    ctx.stroke();
  };

  useEffect(() => {
    if (currentWaveformRef.current) {
      generateWaveform(currentWaveformRef.current, '#ffffff', 0.8);
      drawTransitionZone();
    }
    if (nextWaveformRef.current) {
      generateWaveform(nextWaveformRef.current, '#ffffff', 0.5);
    }
  }, [currentSong, nextSong, currentTime]);

  const handleTransitionTypeClick = (type: 'auto' | 'fade' | 'rise' | 'blend') => {
    setTransitionType(type);
    onTransitionTypeChange(type);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const transitionDurationBeats = Math.ceil(transition.duration * 60 / 60); // Approximation

  return (
    <div className="fixed bottom-24 left-0 right-0 z-40 bg-gradient-to-b from-background/95 to-background backdrop-blur-md border-t border-border/50 shadow-xl">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Waveform Display */}
        <div className="space-y-2 mb-4">
          {/* Current Track Waveform */}
          <div className="relative">
            <canvas
              ref={currentWaveformRef}
              width={1200}
              height={80}
              className="w-full h-20 rounded-lg bg-muted/50"
            />
            <div className="absolute top-2 left-2 flex items-center gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90"
                onClick={onPlayPause}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </div>
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="bg-background/80 backdrop-blur">
                {transitionDurationBeats} bars
              </Badge>
            </div>
          </div>

          {/* Next Track Waveform */}
          <div className="relative">
            <canvas
              ref={nextWaveformRef}
              width={1200}
              height={80}
              className="w-full h-20 rounded-lg bg-muted/50"
            />
          </div>
        </div>

        {/* Song Info */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {currentSong.imageUrl && (
                <img 
                  src={currentSong.imageUrl} 
                  alt={currentSong.title}
                  className="w-10 h-10 rounded"
                />
              )}
              <div>
                <div className="font-semibold text-sm">{currentSong.title}</div>
                <div className="text-xs text-muted-foreground">{currentSong.artist}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              {Math.round(transition.outPoint.time)} bpm
            </Badge>
            <Badge variant="outline">
              {formatTime(transition.duration)}
            </Badge>
            <Badge 
              variant="secondary"
              className={cn(
                "font-mono",
                transition.compatibilityScore > 0.7 && "bg-green-500/20 text-green-500",
                transition.compatibilityScore > 0.4 && transition.compatibilityScore <= 0.7 && "bg-yellow-500/20 text-yellow-500",
                transition.compatibilityScore <= 0.4 && "bg-red-500/20 text-red-500"
              )}
            >
              {Math.round(transition.compatibilityScore * 100)}%
            </Badge>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Volume Overlap */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Volume</span>
              <button className="text-xs text-muted-foreground hover:text-foreground">
                Overlap ▼
              </button>
            </div>
            <Slider
              value={[volumeOverlap]}
              onValueChange={([value]) => {
                setVolumeOverlap(value);
                onVolumeOverlapChange(value);
              }}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* EQ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">EQ</span>
              <button 
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const options = ['End bass swap', 'High cut', 'Mid boost', 'Full range'];
                  const currentIndex = options.indexOf(eqSetting);
                  const nextSetting = options[(currentIndex + 1) % options.length];
                  setEqSetting(nextSetting);
                  onEqChange(nextSetting);
                }}
              >
                {eqSetting} ▼
              </button>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/60" style={{ width: '70%' }} />
            </div>
          </div>

          {/* Effects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Effects</span>
              <button 
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const options = ['Low pass', 'High pass', 'Echo out', 'Reverb'];
                  const currentIndex = options.indexOf(effectSetting);
                  const nextSetting = options[(currentIndex + 1) % options.length];
                  setEffectSetting(nextSetting);
                  onEffectChange(nextSetting);
                }}
              >
                {effectSetting} ▼
              </button>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/60" style={{ width: '45%' }} />
            </div>
          </div>
        </div>

        {/* Transition Type Buttons */}
        <div className="flex gap-2">
          <Button
            variant={transitionType === 'auto' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTransitionTypeClick('auto')}
            className={cn(
              "flex-1 transition-all",
              transitionType === 'auto' && "bg-primary text-primary-foreground"
            )}
          >
            ✨ Auto
          </Button>
          <Button
            variant={transitionType === 'fade' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTransitionTypeClick('fade')}
            className={cn(
              "flex-1 transition-all",
              transitionType === 'fade' && "bg-background text-foreground border-2 border-foreground"
            )}
          >
            Fade
          </Button>
          <Button
            variant={transitionType === 'rise' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTransitionTypeClick('rise')}
            className={cn(
              "flex-1 transition-all",
              transitionType === 'rise' && "bg-background text-foreground border-2 border-foreground"
            )}
          >
            Rise
          </Button>
          <Button
            variant={transitionType === 'blend' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTransitionTypeClick('blend')}
            className={cn(
              "flex-1 transition-all",
              transitionType === 'blend' && "bg-background text-foreground border-2 border-foreground"
            )}
          >
            Blend
          </Button>
        </div>
      </div>
    </div>
  );
};
