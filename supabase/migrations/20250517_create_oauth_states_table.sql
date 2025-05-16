
-- Create the oauth_states table to store CSRF protection states
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '1 hour'),
  provider TEXT NOT NULL,
  used BOOLEAN DEFAULT false
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_provider ON public.oauth_states(provider);

-- Create an RLS policy to allow all operations for authenticated users
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users" 
  ON public.oauth_states FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" 
  ON public.oauth_states FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
  ON public.oauth_states FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Add an expiration function to clean up old states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.oauth_states
  WHERE expires_at < timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set up a trigger to run the cleanup function periodically
DROP TRIGGER IF EXISTS trigger_cleanup_expired_oauth_states ON public.oauth_states;
CREATE TRIGGER trigger_cleanup_expired_oauth_states
AFTER INSERT ON public.oauth_states
EXECUTE PROCEDURE cleanup_expired_oauth_states();
