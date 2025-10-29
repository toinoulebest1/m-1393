
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCog, Upload, Loader2, Clock, CalendarDays, Music, BarChart3, Shield, Palette, Mail, Award, TrendingUp, Headphones } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MusicPreferences } from "./MusicPreferences";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const AccountSettingsDialog = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [signupDate, setSignupDate] = useState<string | null>(null);
  const [lastLogins, setLastLogins] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [stats, setStats] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [email, setEmail] = useState<string>("");
  const [themeAnimation, setThemeAnimation] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setEmail(session.user.email || "");

      // Charger le profil
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('username, avatar_url, signup_date, last_logins, theme_animation')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (profile) {
        setUsername(profile.username || '');
        setAvatarUrl(profile.avatar_url);
        setSignupDate(profile.signup_date);
        setLastLogins(profile.last_logins || []);
        setThemeAnimation(profile.theme_animation || false);
      }

      // Charger le rôle
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role);
      }

      // Charger les statistiques d'écoute
      const { data: statsData } = await supabase
        .from('listening_stats')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (statsData) {
        setStats(statsData);
      }

      // Charger les badges
      const { data: badgesData } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', session.user.id);

      if (badgesData) {
        setBadges(badgesData);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error("Erreur lors du chargement du profil");
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Vous devez être connecté pour effectuer cette action");
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: username,
          theme_animation: themeAnimation,
        })
        .eq('id', session.user.id);

      if (error) throw error;

      toast.success("Profil mis à jour avec succès");
      await fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error("Erreur lors de la mise à jour du profil");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Vous devez être connecté pour effectuer cette action");
        return;
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${session.user.id}/${crypto.randomUUID()}.${fileExt}`;

      // Upload the file to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update the profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success("Avatar mis à jour avec succès");
      await fetchProfile(); // Recharger les données après la mise à jour
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error("Erreur lors du téléchargement de l'avatar");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-spotify-neutral hover:text-white hover:bg-white/5"
        >
          {avatarUrl ? (
            <Avatar className="w-8 h-8">
              <AvatarImage src={avatarUrl} alt="Avatar" />
              <AvatarFallback><UserCog className="w-5 h-5" /></AvatarFallback>
            </Avatar>
          ) : (
            <UserCog className="w-5 h-5" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-spotify-dark text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="w-6 h-6" />
            {t('common.accountSettings')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-5 bg-white/5">
            <TabsTrigger value="profile" className="data-[state=active]:bg-spotify-accent">
              <UserCog className="w-4 h-4 mr-2" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-spotify-accent">
              <BarChart3 className="w-4 h-4 mr-2" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="music" className="data-[state=active]:bg-spotify-accent">
              <Music className="w-4 h-4 mr-2" />
              Musique
            </TabsTrigger>
            <TabsTrigger value="appearance" className="data-[state=active]:bg-spotify-accent">
              <Palette className="w-4 h-4 mr-2" />
              Apparence
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-spotify-accent">
              <Shield className="w-4 h-4 mr-2" />
              Sécurité
            </TabsTrigger>
          </TabsList>

          {/* Onglet Profil */}
          <TabsContent value="profile" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Informations personnelles</CardTitle>
                <CardDescription className="text-gray-400">
                  Gérez votre profil et vos informations publiques
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={avatarUrl || undefined} alt="Avatar" />
                    <AvatarFallback><UserCog className="w-12 h-12" /></AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="avatar-upload"
                      disabled={isUploading}
                    />
                    <label htmlFor="avatar-upload">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isUploading}
                        className="cursor-pointer bg-spotify-accent hover:bg-spotify-accent/80"
                        asChild
                      >
                        <span>
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t('common.uploading')}
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              {t('common.changeAvatar')}
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                    {userRole && (
                      <Badge variant={userRole === 'admin' ? 'default' : 'secondary'}>
                        {userRole === 'admin' ? '👑 Admin' : '👤 Utilisateur'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white">Nom d'utilisateur</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Entrez votre nom d'utilisateur"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Email</Label>
                  <Input
                    value={email}
                    disabled
                    className="bg-white/5 border-white/10 text-white/50"
                  />
                </div>

                {signupDate && (
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <CalendarDays className="w-4 h-4" />
                    <span>Membre depuis le {format(new Date(signupDate), "d MMMM yyyy", { locale: fr })}</span>
                  </div>
                )}

                <Button
                  onClick={handleUpdateProfile}
                  disabled={isLoading}
                  className="w-full bg-spotify-accent hover:bg-spotify-accent/80"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mise à jour...
                    </>
                  ) : (
                    "Enregistrer les modifications"
                  )}
                </Button>
              </CardContent>
            </Card>

            {badges.length > 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Badges & Récompenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <Badge key={badge.id} variant="outline" className="text-yellow-400 border-yellow-400">
                        🏆 {badge.badge_id}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Onglet Statistiques */}
          <TabsContent value="stats" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Statistiques d'écoute</CardTitle>
                <CardDescription className="text-gray-400">
                  Vos habitudes d'écoute en détail
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-spotify-accent/20 rounded-lg">
                          <Headphones className="w-6 h-6 text-spotify-accent" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Morceaux écoutés</p>
                          <p className="text-2xl font-bold text-white">{stats.tracks_played || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-spotify-accent/20 rounded-lg">
                          <Clock className="w-6 h-6 text-spotify-accent" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Temps d'écoute</p>
                          <p className="text-2xl font-bold text-white">
                            {formatDuration(stats.total_listening_time || 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {stats.peak_hours && Object.keys(stats.peak_hours).length > 0 && (
                      <div className="bg-white/5 rounded-lg p-4 md:col-span-2">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-5 h-5 text-spotify-accent" />
                          <p className="text-sm font-medium text-white">Heures de pointe</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(stats.peak_hours).map(([hour, count]: [string, any]) => (
                            <Badge key={hour} variant="secondary">
                              {hour}h: {count} écoutes
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-8">
                    Aucune statistique disponible pour le moment
                  </p>
                )}
              </CardContent>
            </Card>

            {lastLogins.length > 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Historique de connexion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lastLogins.slice(0, 5).map((login: any, index: number) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                        <span className="text-white/80">
                          {format(new Date(login.timestamp), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                        {index === 0 && (
                          <Badge variant="outline" className="text-green-400 border-green-400">
                            Dernière connexion
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Onglet Musique */}
          <TabsContent value="music">
            <MusicPreferences />
          </TabsContent>

          {/* Onglet Apparence */}
          <TabsContent value="appearance">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Personnalisation</CardTitle>
                <CardDescription className="text-gray-400">
                  Personnalisez l'apparence de votre interface
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="theme-animation" className="text-white">Animations de thème</Label>
                    <p className="text-sm text-gray-400">Activer les animations visuelles</p>
                  </div>
                  <Switch
                    id="theme-animation"
                    checked={themeAnimation}
                    onCheckedChange={setThemeAnimation}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Sécurité */}
          <TabsContent value="security">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Sécurité du compte</CardTitle>
                <CardDescription className="text-gray-400">
                  Gérez la sécurité et la confidentialité
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email de connexion
                  </Label>
                  <Input
                    value={email}
                    disabled
                    className="bg-white/5 border-white/10 text-white/50"
                  />
                  <p className="text-xs text-gray-400">
                    Pour modifier votre email, contactez le support
                  </p>
                </div>

                <Separator className="bg-white/10" />

                <div className="space-y-2">
                  <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                    Changer le mot de passe
                  </Button>
                  <Button variant="outline" className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10">
                    Supprimer le compte
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
