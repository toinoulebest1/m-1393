-- Ajouter le champ deezer_id à la table songs pour éviter de rechercher l'ID à chaque fois
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS deezer_id text;

-- Créer un index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_songs_deezer_id ON public.songs(deezer_id);