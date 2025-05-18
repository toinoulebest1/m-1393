
export interface OneDriveConfig {
  accessToken: string;
  refreshToken: string;
  isEnabled: boolean;
  clientId: string;
}

export interface OneDriveFileReference {
  id: string;
  onedrive_path: string;
  local_id: string;
  file_id?: string;
  file_name?: string;
  created_at?: string;
}

// Ajouter un type pour le provider de stockage
export type StorageProvider = 'supabase' | 'dropbox' | 'onedrive';
