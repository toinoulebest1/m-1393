
-- Create a function to add the storage_provider column to songs table
-- This will only add the column if it doesn't exist yet
CREATE OR REPLACE FUNCTION public.add_storage_provider_column()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  -- Check if the column already exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'songs' AND column_name = 'storage_provider'
  ) INTO column_exists;
  
  -- Add the column if it doesn't exist
  IF NOT column_exists THEN
    ALTER TABLE public.songs ADD COLUMN storage_provider TEXT DEFAULT 'supabase';
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;
