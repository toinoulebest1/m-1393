import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Users } from 'lucide-react';
import { useListeningSession } from '@/contexts/ListeningSessionContext';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { SessionControlMode, SessionVisibility } from '@/types/listeningSession';

export const CreateSessionDialog = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<SessionControlMode>('host');
  const [visibility, setVisibility] = useState<SessionVisibility>('private');
  const { createSession } = useListeningSession();
  const { currentSong } = usePlayerContext();

  const handleCreate = async () => {
    if (!name.trim() || !currentSong) return;

    await createSession(name, mode, visibility, currentSong.id);
    setOpen(false);
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="w-4 h-4" />
          Créer une session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer une session d'écoute partagée</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="session-name">Nom de la session</Label>
            <Input
              id="session-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ma session d'écoute"
            />
          </div>

          <div>
            <Label>Mode de contrôle</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as SessionControlMode)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="host" id="mode-host" />
                <Label htmlFor="mode-host">Hôte (seul l'hôte contrôle)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="democratic" id="mode-democratic" />
                <Label htmlFor="mode-democratic">Démocratique (votes)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="silent" id="mode-silent" />
                <Label htmlFor="mode-silent">Silencieux (pas de chat)</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Visibilité</Label>
            <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as SessionVisibility)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="vis-private" />
                <Label htmlFor="vis-private">Privée (avec code)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="vis-public" />
                <Label htmlFor="vis-public">Publique</Label>
              </div>
            </RadioGroup>
          </div>

          {!currentSong && (
            <p className="text-sm text-muted-foreground">
              Lancez une chanson avant de créer une session
            </p>
          )}

          <Button 
            onClick={handleCreate} 
            disabled={!name.trim() || !currentSong}
            className="w-full"
          >
            Créer la session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
