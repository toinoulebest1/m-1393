import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook pour sauvegarder et restaurer la position de scroll
 */
export const useScrollPosition = () => {
  const location = useLocation();
  const scrollKey = `scroll-${location.pathname}`;

  // Sauvegarder la position de scroll avant de naviguer
  const saveScrollPosition = () => {
    const scrollY = window.scrollY;
    sessionStorage.setItem(scrollKey, scrollY.toString());
  };

  // Restaurer la position de scroll
  useEffect(() => {
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll !== null) {
      // Petit délai pour s'assurer que le contenu est chargé
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedScroll, 10));
      });
    }
  }, [scrollKey]);

  return { saveScrollPosition };
};
