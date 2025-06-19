
-- Créer une table pour les annonces de nouveautés
CREATE TABLE public.site_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ajouter une fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Créer un trigger pour la table site_announcements
CREATE TRIGGER update_site_announcements_updated_at 
    BEFORE UPDATE ON public.site_announcements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Créer une table pour suivre quels utilisateurs ont vu quelles annonces
CREATE TABLE public.user_announcement_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.site_announcements(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, announcement_id)
);

-- Activer RLS sur les tables
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_announcement_views ENABLE ROW LEVEL SECURITY;

-- Politique pour les annonces : tout le monde peut voir les annonces actives
CREATE POLICY "Everyone can view active announcements" 
  ON public.site_announcements 
  FOR SELECT 
  USING (is_active = true);

-- Politique pour les vues d'annonces : les utilisateurs peuvent voir et insérer leurs propres vues
CREATE POLICY "Users can view their own announcement views" 
  ON public.user_announcement_views 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own announcement views" 
  ON public.user_announcement_views 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
