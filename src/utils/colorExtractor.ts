
import ColorThief from 'colorthief';

export const extractDominantColor = async (
  imageUrl: string
): Promise<[number, number, number] | null> => {
  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    const colorThief = new ColorThief();
    const color = colorThief.getColor(img);
    const saturatedColor: [number, number, number] = [
      Math.min(255, color[0] * 1.2),
      Math.min(255, color[1] * 1.2),
      Math.min(255, color[2] * 1.2)
    ];
    return saturatedColor;
  } catch (error) {
    console.error('Error extracting dominant color:', error);
    return null;
  }
};
