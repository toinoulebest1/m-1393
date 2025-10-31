import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';
import { useListeningSession } from '@/contexts/ListeningSessionContext';

export const JoinSessionDialog = () => {
  const [open, setOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const { joinSession } = useListeningSession();

  const handleJoin = async () => {
    if (!joinCode.trim()) return;

    await joinSession(joinCode);
    setOpen(false);
    setJoinCode('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Rejoindre
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rejoindre une session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="join-code">Code de la session</Label>
            <Input
              id="join-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
            />
          </div>

          <Button 
            onClick={handleJoin} 
            disabled={!joinCode.trim()}
            className="w-full"
          >
            Rejoindre
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
