
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Globe, Lock, Users, Settings, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface PlaylistVisibilitySettingsProps {
  playlistId: string;
  currentVisibility: string;
  onVisibilityChanged: (newVisibility: string) => void;
}

interface Friend {
  id: string;
  friend_user_id: string;
  added_at: string;
}

interface User {
  id: string;
  username: string;
}

export const PlaylistVisibilitySettings = ({ 
  playlistId, 
  currentVisibility, 
  onVisibilityChanged 
}: PlaylistVisibilitySettingsProps) => {
  const [visibility, setVisibility] = useState(currentVisibility);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const fetchFriends = async () => {
    try {
      const { data, error } = await supabase
        .from('playlist_friends')
        .select('*')
        .eq('playlist_id', playlistId);

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleVisibilityChange = async (newVisibility: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('playlists')
        .update({ visibility: newVisibility })
        .eq('id', playlistId);

      if (error) throw error;

      setVisibility(newVisibility);
      onVisibilityChanged(newVisibility);
      
      toast({
        description: "Visibilité mise à jour avec succès"
      });
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la visibilité",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addFriend = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('playlist_friends')
        .insert({
          playlist_id: playlistId,
          friend_user_id: userId
        });

      if (error) throw error;

      await fetchFriends();
      setSearchQuery("");
      setAllUsers([]);
      
      toast({
        description: "Ami ajouté avec succès"
      });
    } catch (error) {
      console.error("Error adding friend:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter cet ami",
        variant: "destructive"
      });
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const { error } = await supabase
        .from('playlist_friends')
        .delete()
        .eq('id', friendId);

      if (error) throw error;

      await fetchFriends();
      
      toast({
        description: "Ami retiré avec succès"
      });
    } catch (error) {
      console.error("Error removing friend:", error);
      toast({
        title: "Erreur",
        description: "Impossible de retirer cet ami",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (open) {
      fetchFriends();
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      fetchUsers();
    } else {
      setAllUsers([]);
    }
  }, [searchQuery]);

  const getVisibilityIcon = () => {
    switch (visibility) {
      case 'public':
        return <Globe className="h-4 w-4" />;
      case 'friends':
        return <Users className="h-4 w-4" />;
      default:
        return <Lock className="h-4 w-4" />;
    }
  };

  const getVisibilityLabel = () => {
    switch (visibility) {
      case 'public':
        return "Publique";
      case 'friends':
        return "Amis uniquement";
      default:
        return "Privée";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 border border-spotify-neutral">
          {getVisibilityIcon()}
          <span className="hidden sm:inline">{getVisibilityLabel()}</span>
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-spotify-dark text-white border-spotify-card max-w-md">
        <DialogHeader>
          <DialogTitle>Paramètres de visibilité</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <RadioGroup value={visibility} onValueChange={handleVisibilityChange}>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-spotify-card transition-colors">
                <RadioGroupItem value="private" id="private" />
                <Lock className="h-5 w-5 text-spotify-neutral" />
                <div className="flex-1">
                  <Label htmlFor="private" className="text-white font-medium cursor-pointer">
                    Privée
                  </Label>
                  <p className="text-sm text-spotify-neutral">
                    Vous seul pouvez voir cette playlist
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-spotify-card transition-colors">
                <RadioGroupItem value="friends" id="friends" />
                <Users className="h-5 w-5 text-spotify-neutral" />
                <div className="flex-1">
                  <Label htmlFor="friends" className="text-white font-medium cursor-pointer">
                    Amis uniquement
                  </Label>
                  <p className="text-sm text-spotify-neutral">
                    Seuls les amis sélectionnés peuvent voir cette playlist
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-spotify-card transition-colors">
                <RadioGroupItem value="public" id="public" />
                <Globe className="h-5 w-5 text-spotify-neutral" />
                <div className="flex-1">
                  <Label htmlFor="public" className="text-white font-medium cursor-pointer">
                    Publique
                  </Label>
                  <p className="text-sm text-spotify-neutral">
                    Tout le monde peut voir cette playlist
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>

          {visibility === 'friends' && (
            <div className="space-y-4">
              <div className="border-t border-spotify-card pt-4">
                <h4 className="font-medium mb-3">Gérer les amis autorisés</h4>
                
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      placeholder="Rechercher un utilisateur..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-spotify-input border-spotify-border text-white"
                    />
                    
                    {allUsers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-spotify-card border border-spotify-border rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                        {allUsers.map((user) => (
                          <div
                            key={user.id}
                            className="p-2 hover:bg-spotify-card-hover cursor-pointer flex items-center justify-between"
                            onClick={() => addFriend(user.id)}
                          >
                            <span className="text-white">{user.username}</span>
                            <Plus className="h-4 w-4 text-spotify-accent" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {friends.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-spotify-neutral">Amis autorisés :</p>
                      <div className="flex flex-wrap gap-2">
                        {friends.map((friend) => (
                          <Badge
                            key={friend.id}
                            variant="secondary"
                            className="bg-spotify-accent/20 text-spotify-accent hover:bg-spotify-accent/30 flex items-center gap-1"
                          >
                            Ami {friend.friend_user_id.slice(0, 8)}...
                            <button
                              onClick={() => removeFriend(friend.id)}
                              className="ml-1 hover:text-red-400"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
