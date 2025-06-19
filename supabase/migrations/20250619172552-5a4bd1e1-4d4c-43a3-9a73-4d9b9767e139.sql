
-- Créer une table pour stocker les emails des utilisateurs qui veulent être notifiés
CREATE TABLE public.maintenance_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ajouter un index sur l'email pour éviter les doublons et optimiser les requêtes
CREATE UNIQUE INDEX idx_maintenance_notifications_email ON public.maintenance_notifications (email);

-- Ajouter RLS (Row Level Security) - tout le monde peut s'inscrire, seuls les admins peuvent voir
ALTER TABLE public.maintenance_notifications ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre à tous d'insérer leur email
CREATE POLICY "Anyone can subscribe to maintenance notifications" 
  ON public.maintenance_notifications 
  FOR INSERT 
  TO public
  WITH CHECK (true);

-- Politique pour permettre aux admins de voir tous les emails
CREATE POLICY "Admins can view all maintenance notifications" 
  ON public.maintenance_notifications 
  FOR SELECT 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Politique pour permettre aux admins de supprimer (pour la purge)
CREATE POLICY "Admins can delete maintenance notifications" 
  ON public.maintenance_notifications 
  FOR DELETE 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
