import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  return data.session;
};

export const useSessionQuery = () => {
  return useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};