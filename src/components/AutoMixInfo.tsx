import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const AutoMixInfo = () => {
  return (
    <Alert className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
      <Info className="h-4 w-4" />
      <AlertTitle className="text-base font-semibold">
        🎵 Auto-Mix DJ - Gratuit et Sans Limite
      </AlertTitle>
      <AlertDescription className="space-y-2 text-sm">
        <p>
          Transformez votre playlist en véritable DJ set avec des transitions automatiques,
          fluides et professionnelles.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            <span className="text-xs">Totalement gratuit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            <span className="text-xs">Sans publicité</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            <span className="text-xs">Sync BPM & tonalité</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            <span className="text-xs">4 modes de mix</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 italic">
          Le système analyse automatiquement vos morceaux (BPM, tonalité, structure)
          et crée des transitions intelligentes synchronisées sur les temps musicaux,
          comme un vrai DJ professionnel.
        </p>
      </AlertDescription>
    </Alert>
  );
};
