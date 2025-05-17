
import React, { useEffect } from 'react';
import { DropboxSettings } from './DropboxSettings';
import { useSettingsMigration } from '@/utils/userSettingsMigration';

const DropboxSettingsWrapper: React.FC = () => {
  // Utiliser le hook de migration pour assurer que les paramètres sont migrés
  useSettingsMigration();
  
  return <DropboxSettings />;
};

export default DropboxSettingsWrapper;
