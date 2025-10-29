
import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar } from "./ui/calendar";
import { CalendarIcon, Ban, UserX, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface UserBan {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string;
  ban_type: string;
  expires_at: string | null;
  created_at: string;
  is_active: boolean;
  user_profile?: {
    username: string;
  };
  banned_by_profile?: {
    username: string;
  };
}

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
}

export const UserBanManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [banType, setBanType] = useState<"temporary" | "permanent">("temporary");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bans, setBans] = useState<UserBan[]>([]);

  // Charger les utilisateurs
  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchTerm}%`)
        .limit(10);

      if (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        return;
      }
      
      setUsers(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    }
  };

  // Charger les bannissements actifs
  const loadBans = async () => {
    try {
      // Récupérer les bans
      const { data: bansData, error: bansError } = await supabase
        .from('user_bans')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (bansError) {
        console.error('Erreur lors du chargement des bannissements:', bansError);
        return;
      }

      // Récupérer les profils des utilisateurs bannis et de ceux qui ont banni
      const userIds = [...new Set([
        ...(bansData?.map(ban => ban.user_id) || []),
        ...(bansData?.map(ban => ban.banned_by) || [])
      ])];

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      if (profilesError) {
        console.error('Erreur lors du chargement des profils:', profilesError);
        return;
      }

      // Associer les profils aux bans
      const bansWithProfiles = bansData?.map(ban => ({
        ...ban,
        user_profile: profilesData?.find(p => p.id === ban.user_id),
        banned_by_profile: profilesData?.find(p => p.id === ban.banned_by)
      })) || [];

      setBans(bansWithProfiles);
    } catch (error) {
      console.error('Erreur lors du chargement des bannissements:', error);
    }
  };

  useEffect(() => {
    if (searchTerm.length > 0) {
      const timeoutId = setTimeout(() => {
        loadUsers();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setUsers([]);
    }
  }, [searchTerm]);

  useEffect(() => {
    loadBans();
  }, []);

  const handleBanUser = async () => {
    if (!selectedUser || !reason.trim()) {
      toast.error('Veuillez sélectionner un utilisateur et indiquer une raison');
      return;
    }

    if (banType === 'temporary' && !expiresAt) {
      toast.error('Veuillez sélectionner une date d\'expiration pour un ban temporaire');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Utilisateur non connecté');
        return;
      }

      const { error } = await supabase
        .from('user_bans')
        .insert({
          user_id: selectedUser,
          banned_by: user.id,
          reason: reason.trim(),
          ban_type: banType,
          expires_at: banType === 'temporary' ? expiresAt?.toISOString() : null
        });

      if (error) {
        console.error('Erreur lors du bannissement:', error);
        toast.error('Erreur lors du bannissement de l\'utilisateur: ' + error.message);
        return;
      }

      toast.success('Utilisateur banni avec succès');
      
      // Réinitialiser le formulaire
      setSelectedUser("");
      setReason("");
      setExpiresAt(undefined);
      setBanType("temporary");
      setSearchTerm("");
      
      // Recharger la liste des bans
      loadBans();
    } catch (error) {
      console.error('Erreur lors du bannissement:', error);
      toast.error('Erreur lors du bannissement de l\'utilisateur');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnbanUser = async (banId: string) => {
    try {
      const { error } = await supabase
        .from('user_bans')
        .update({ is_active: false })
        .eq('id', banId);

      if (error) {
        console.error('Erreur lors du débannissement:', error);
        toast.error('Erreur lors du débannissement: ' + error.message);
        return;
      }

      toast.success('Utilisateur débanni avec succès');
      loadBans();
    } catch (error) {
      console.error('Erreur lors du débannissement:', error);
      toast.error('Erreur lors du débannissement');
    }
  };

  const selectedUserProfile = users.find(u => u.id === selectedUser);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Ban className="w-5 h-5 text-red-500" />
        <h3 className="text-lg font-semibold text-white">Gestion des Bannissements</h3>
      </div>

      {/* Formulaire de bannissement */}
      <div className="bg-spotify-dark p-4 rounded-lg space-y-4">
        <h4 className="font-medium text-white">Bannir un utilisateur</h4>
        
        {/* Recherche d'utilisateur */}
        <div>
          <Label htmlFor="userSearch">Rechercher un utilisateur</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-spotify-neutral" />
            <Input
              id="userSearch"
              placeholder="Nom d'utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Utilisateur sélectionné */}
          {selectedUserProfile && (
            <div className="mt-2 p-2 bg-spotify-accent/20 border border-spotify-accent/30 rounded-md flex items-center gap-2">
              <div className="w-6 h-6 bg-spotify-accent rounded-full flex items-center justify-center text-xs">
                {selectedUserProfile.username?.[0]?.toUpperCase()}
              </div>
              <span className="text-white font-medium">{selectedUserProfile.username}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedUser("");
                  setSearchTerm("");
                }}
                className="ml-auto text-xs"
              >
                ✕
              </Button>
            </div>
          )}
          
          {/* Liste des utilisateurs trouvés */}
          {users.length > 0 && searchTerm && !selectedUser && (
            <div className="mt-2 bg-spotify-card border border-spotify-neutral/20 rounded-md max-h-48 overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-2 hover:bg-spotify-dark cursor-pointer flex items-center gap-2"
                  onClick={() => {
                    setSelectedUser(user.id);
                    setSearchTerm(user.username || '');
                  }}
                >
                  <div className="w-6 h-6 bg-spotify-accent rounded-full flex items-center justify-center text-xs">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-white">{user.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Type de bannissement */}
        <div>
          <Label htmlFor="banType">Type de bannissement</Label>
          <Select value={banType} onValueChange={(value: "temporary" | "permanent") => setBanType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="temporary">Temporaire</SelectItem>
              <SelectItem value="permanent">Définitif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date d'expiration pour ban temporaire */}
        {banType === 'temporary' && (
          <div>
            <Label>Date d'expiration</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiresAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiresAt ? format(expiresAt, "PPP") : <span>Choisir une date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={setExpiresAt}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Raison du bannissement */}
        <div>
          <Label htmlFor="banReason">Raison du bannissement</Label>
          <Textarea
            id="banReason"
            placeholder="Expliquez la raison du bannissement..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <Button 
          onClick={handleBanUser} 
          disabled={isLoading || !selectedUser || !reason.trim()}
          className="w-full"
          variant="destructive"
        >
          {isLoading ? (
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <UserX className="w-4 h-4 mr-2" />
              Bannir l'utilisateur
            </>
          )}
        </Button>
      </div>

      {/* Liste des bannissements actifs */}
      <div className="bg-spotify-dark p-4 rounded-lg">
        <h4 className="font-medium text-white mb-4">Bannissements actifs</h4>
        
        {bans.length === 0 ? (
          <p className="text-spotify-neutral">Aucun bannissement actif</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead>Expire le</TableHead>
                <TableHead>Banni par</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bans.map((ban) => (
                <TableRow key={ban.id}>
                  <TableCell>{ban.user_profile?.username || 'Utilisateur inconnu'}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded text-xs",
                      ban.ban_type === 'permanent' 
                        ? "bg-red-500/20 text-red-400" 
                        : "bg-orange-500/20 text-orange-400"
                    )}>
                      {ban.ban_type === 'permanent' ? 'Définitif' : 'Temporaire'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{ban.reason}</TableCell>
                  <TableCell>
                    {ban.expires_at 
                      ? format(new Date(ban.expires_at), "dd/MM/yyyy HH:mm") 
                      : 'Jamais'
                    }
                  </TableCell>
                  <TableCell>{ban.banned_by_profile?.username || 'Admin'}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnbanUser(ban.id)}
                    >
                      Débannir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
