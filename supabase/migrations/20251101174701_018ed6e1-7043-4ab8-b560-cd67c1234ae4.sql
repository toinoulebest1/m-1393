-- Seed Tidal ID for the song CIEL by GIMS so Phoenix streaming works immediately
UPDATE public.songs
SET tidal_id = '394135869'
WHERE lower(title) = 'ciel' AND lower(artist) LIKE 'gims%';