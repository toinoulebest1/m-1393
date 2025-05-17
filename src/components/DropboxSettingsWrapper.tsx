
import React from 'react';
import { DropboxSettings } from './DropboxSettings';

const DropboxSettingsWrapper: React.FC = () => {
  // Ce composant wrapper existe pour garder la compatibilité avec le code existant
  // tout en permettant l'utilisation de la nouvelle table user_settings
  return <DropboxSettings />;
};

export default DropboxSettingsWrapper;
