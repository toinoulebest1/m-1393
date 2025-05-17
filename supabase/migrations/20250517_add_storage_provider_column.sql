
-- Ce script SQL ajoute la colonne storage_provider à la table songs
ALTER TABLE IF EXISTS public.songs ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'supabase';

-- Création d'une fonction RPC pour ajouter dynamiquement une colonne à une table
CREATE OR REPLACE FUNCTION public.alter_table_add_column(
  table_name TEXT,
  column_name TEXT,
  column_type TEXT,
  column_default TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  column_exists BOOLEAN;
  sql_command TEXT;
BEGIN
  -- Vérifier si la colonne existe déjà
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = alter_table_add_column.table_name
    AND column_name = alter_table_add_column.column_name
  ) INTO column_exists;
  
  -- Ajouter la colonne si elle n'existe pas
  IF NOT column_exists THEN
    sql_command := format(
      'ALTER TABLE public.%I ADD COLUMN %I %s',
      table_name,
      column_name,
      column_type
    );
    
    -- Ajouter la valeur par défaut si elle est fournie
    IF column_default IS NOT NULL THEN
      sql_command := sql_command || format(' DEFAULT %s', column_default);
    END IF;
    
    EXECUTE sql_command;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;
