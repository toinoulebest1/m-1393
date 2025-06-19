
-- Créer le type enum pour les rôles s'il n'existe pas déjà
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Créer la fonction has_role pour vérifier les rôles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  )
$$;

-- Créer une table pour les paramètres de maintenance
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ajouter RLS pour que seuls les admins puissent modifier
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre à tous de lire (pour vérifier le statut de maintenance)
CREATE POLICY "Anyone can read site settings" 
  ON public.site_settings 
  FOR SELECT 
  TO public
  USING (true);

-- Politique pour permettre aux admins de modifier
CREATE POLICY "Admins can modify site settings" 
  ON public.site_settings 
  FOR ALL 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insérer les paramètres par défaut
INSERT INTO public.site_settings (key, value) VALUES 
('maintenance_mode', 'false'),
('maintenance_message', 'Le site est actuellement en maintenance. Nous reviendrons bientôt !');
