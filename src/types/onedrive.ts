
export interface OneDriveConfig {
  accessToken: string;
  refreshToken: string;
  isEnabled: boolean;
  clientId: string; // Ajouté pour stocker le Client ID Microsoft
}

export interface OneDriveFileReference {
  id: string;
  onedrive_path: string;
  local_id: string;
  file_id?: string;
  file_name?: string;
  created_at?: string;
}
