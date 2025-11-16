import { ReactNode } from 'react';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import { useSessionDetection } from '@/hooks/useSessionDetection';

interface SessionDetectionWrapperProps {
  children: ReactNode;
}

export const SessionDetectionWrapper = ({ children }: SessionDetectionWrapperProps) => {
  const { data: session } = useSessionQuery();
  
  // Détection de sessions multiples
  useSessionDetection(session?.user?.id);
  
  return <>{children}</>;
};
