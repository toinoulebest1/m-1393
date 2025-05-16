
-- Ajouter un champ storage_provider à la table dropbox_files pour suivre où les fichiers sont réellement stockés
ALTER TABLE "public"."dropbox_files" 
ADD COLUMN IF NOT EXISTS "storage_provider" TEXT DEFAULT 'dropbox';

-- Mettre à jour les entrées existantes
UPDATE "public"."dropbox_files"
SET "storage_provider" = 'dropbox'
WHERE "storage_provider" IS NULL;

-- Créer un index sur ce champ pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_dropbox_files_storage_provider ON "public"."dropbox_files" ("storage_provider");
