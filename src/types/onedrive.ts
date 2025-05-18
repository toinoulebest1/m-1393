
export interface OneDriveConfig {
  accessToken: string;
  refreshToken: string;
  isEnabled: boolean;
}

export interface OneDriveFileReference {
  id: string;
  onedrive_path: string;
  local_id: string;
  created_at?: string;
}
