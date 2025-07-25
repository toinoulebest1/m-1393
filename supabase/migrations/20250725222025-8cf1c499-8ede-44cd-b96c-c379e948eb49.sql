-- Ajouter contrainte unique sur local_id pour permettre les upserts
ALTER TABLE public.dropbox_files ADD CONSTRAINT dropbox_files_local_id_unique UNIQUE (local_id);

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_dropbox_files_local_id ON public.dropbox_files(local_id);