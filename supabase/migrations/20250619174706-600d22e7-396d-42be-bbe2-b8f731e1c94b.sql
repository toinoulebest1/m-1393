
-- Créer une table pour gérer les bannissements d'utilisateurs
CREATE TABLE public.user_bans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text NOT NULL,
  ban_type text NOT NULL CHECK (ban_type IN ('temporary', 'permanent')),
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- Ajouter des commentaires pour clarifier les colonnes
COMMENT ON COLUMN public.user_bans.user_id IS 'ID de l''utilisateur banni';
COMMENT ON COLUMN public.user_bans.banned_by IS 'ID de l''administrateur qui a effectué le bannissement';
COMMENT ON COLUMN public.user_bans.ban_type IS 'Type de ban: temporary ou permanent';
COMMENT ON COLUMN public.user_bans.expires_at IS 'Date d''expiration pour les bans temporaires (NULL pour permanent)';
COMMENT ON COLUMN public.user_bans.is_active IS 'Indique si le ban est encore actif';

-- Créer un index pour optimiser les requêtes
CREATE INDEX idx_user_bans_user_id ON public.user_bans(user_id);
CREATE INDEX idx_user_bans_active ON public.user_bans(is_active, expires_at);

-- Activer RLS sur la table
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- Créer une politique pour que seuls les admins puissent voir et gérer les bannissements
CREATE POLICY "Admins can manage user bans" 
  ON public.user_bans 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'admin'));

-- Fonction pour vérifier si un utilisateur est banni
CREATE OR REPLACE FUNCTION public.is_user_banned(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE user_bans.user_id = $1
    AND is_active = true
    AND (ban_type = 'permanent' OR expires_at > now())
  );
$$;

-- Fonction pour désactiver automatiquement les bans expirés
CREATE OR REPLACE FUNCTION public.deactivate_expired_bans()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.user_bans 
  SET is_active = false 
  WHERE ban_type = 'temporary' 
  AND expires_at <= now() 
  AND is_active = true;
$$;
