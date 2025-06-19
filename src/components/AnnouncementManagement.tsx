
import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Edit, Plus } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const AnnouncementManagement = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    is_active: false
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('site_announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des annonces:', error);
      toast.error('Erreur lors du chargement des annonces');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingId) {
        // Mise à jour
        const { error } = await supabase
          .from('site_announcements')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Annonce mise à jour avec succès !');
      } else {
        // Création
        const { error } = await supabase
          .from('site_announcements')
          .insert([formData]);

        if (error) throw error;
        toast.success('Annonce créée avec succès !');
      }

      setFormData({ title: "", content: "", is_active: false });
      setEditingId(null);
      fetchAnnouncements();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setFormData({
      title: announcement.title,
      content: announcement.content,
      is_active: announcement.is_active
    });
    setEditingId(announcement.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette annonce ?')) return;

    try {
      const { error } = await supabase
        .from('site_announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Annonce supprimée avec succès !');
      fetchAnnouncements();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCancel = () => {
    setFormData({ title: "", content: "", is_active: false });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {editingId ? 'Modifier l\'annonce' : 'Créer une nouvelle annonce'}
          </CardTitle>
          <CardDescription>
            Les annonces actives seront affichées aux utilisateurs lors de leur prochaine visite
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Titre de l'annonce</Label>
              <Input
                id="title"
                placeholder="Ex: Nouvelles fonctionnalités disponibles !"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="content">Contenu de l'annonce</Label>
              <Textarea
                id="content"
                placeholder="Décrivez les nouveautés du site..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={4}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Activer l'annonce</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-spotify-accent border-t-transparent" />
                ) : editingId ? (
                  'Mettre à jour'
                ) : (
                  'Créer l\'annonce'
                )}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Annuler
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Liste des annonces */}
      <Card>
        <CardHeader>
          <CardTitle>Annonces existantes</CardTitle>
          <CardDescription>
            Gérez toutes vos annonces existantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Aucune annonce créée pour le moment
            </p>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`p-4 border rounded-lg ${
                    announcement.is_active
                      ? 'border-green-500 bg-green-500/5'
                      : 'border-gray-600 bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-white">{announcement.title}</h3>
                        {announcement.is_active && (
                          <span className="px-2 py-1 text-xs bg-green-500 text-white rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{announcement.content}</p>
                      <p className="text-xs text-gray-500">
                        Créée le {new Date(announcement.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(announcement)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(announcement.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
