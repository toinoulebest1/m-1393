-- Fix the join_code generation by making it use a default value with the function
ALTER TABLE public.listening_sessions 
ALTER COLUMN join_code SET DEFAULT upper(substring(md5(random()::text) from 1 for 6));