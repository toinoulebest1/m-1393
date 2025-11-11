// Audio proxy service stub
export const audioProxyService = {
  getProxiedUrl: (url: string) => url,
  preloadTrack: async (trackId: string, quality?: string) => { 
    // Implement preloading logic
  }
};

export const getProxiedAudioUrl = (url: string) => {
  return url;
};



