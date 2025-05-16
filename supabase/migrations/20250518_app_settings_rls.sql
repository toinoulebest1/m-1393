
-- Politique permettant aux administrateurs de sélectionner les paramètres
CREATE POLICY "Les administrateurs peuvent voir les paramètres" 
ON public.app_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Politique permettant aux administrateurs de mettre à jour les paramètres
CREATE POLICY "Les administrateurs peuvent mettre à jour les paramètres" 
ON public.app_settings 
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Politique permettant aux administrateurs d'insérer des paramètres
CREATE POLICY "Les administrateurs peuvent créer des paramètres" 
ON public.app_settings 
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Politique permettant aux administrateurs de supprimer des paramètres
CREATE POLICY "Les administrateurs peuvent supprimer des paramètres" 
ON public.app_settings 
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
