
export interface OneDriveConfig {
  accessToken: string;
  refreshToken: string;
  isEnabled: boolean;
  clientId: string;
  isShared?: boolean; // Added to indicate if the config is shared with all users
  useDirectLinks?: boolean; // New option to choose between API and direct links
}

export interface OneDriveFileReference {
  id: string;
  onedrive_path: string;
  local_id: string;
  file_id?: string;
  file_name?: string;
  created_at?: string;
}

// Helper type for JSON compatibility
export type OneDriveConfigJson = {
  accessToken: string;
  refreshToken: string;
  isEnabled: boolean;
  clientId: string;
  isShared?: boolean;
  useDirectLinks?: boolean;
}
