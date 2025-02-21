
import React, { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const AdBanner = () => {
  useEffect(() => {
    try {
      if (window.adsbygoogle) {
        window.adsbygoogle.push({});
      }
    } catch (err) {
      console.error('Erreur AdSense:', err);
    }
  }, []);

  return (
    <div className="p-4 mx-2">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-VOTRE_ID_CLIENT" // Remplacez par votre ID client
        data-ad-slot="VOTRE_ID_SLOT" // Remplacez par votre ID de slot
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};
