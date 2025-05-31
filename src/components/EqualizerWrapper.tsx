
import React from 'react';
import { AudioEqualizer } from './AudioEqualizer';
import { useEqualizer } from '@/hooks/useEqualizer';
import { usePlayer } from '@/contexts/PlayerContext';

interface EqualizerWrapperProps {
  onClose: () => void;
}

export const EqualizerWrapper: React.FC<EqualizerWrapperProps> = ({ onClose }) => {
  const { getCurrentAudioElement } = usePlayer();
  const audioElement = getCurrentAudioElement();
  
  const equalizer = useEqualizer({ audioElement });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 bg-white text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold hover:bg-gray-200"
        >
          ×
        </button>
        <AudioEqualizer
          settings={equalizer.settings}
          presets={equalizer.presets}
          currentPreset={equalizer.currentPreset}
          isEnabled={equalizer.isEnabled}
          isInitialized={equalizer.isInitialized}
          onUpdateBand={equalizer.updateBand}
          onApplyPreset={equalizer.applyPreset}
          onToggleEnabled={equalizer.toggleEnabled}
          onReset={equalizer.resetEqualizer}
          onSetPreAmp={equalizer.setPreAmp}
          onInitialize={equalizer.initializeAudioContext}
        />
      </div>
    </div>
  );
};
