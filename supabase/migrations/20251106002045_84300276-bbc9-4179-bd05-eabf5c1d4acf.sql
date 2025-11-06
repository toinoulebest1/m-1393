-- Ajouter le champ tidal_id dans la table songs
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS tidal_id TEXT;

-- Créer un index pour accélérer les recherches par tidal_id
CREATE INDEX IF NOT EXISTS idx_songs_tidal_id ON public.songs(tidal_id);

-- Commentaire pour documenter le champ
COMMENT ON COLUMN public.songs.tidal_id IS 'ID du track sur Tidal, utilisé pour le streaming haute qualité via les proxies multi-API';