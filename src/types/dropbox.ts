
export interface DropboxConfig {
  accessToken: string;
  isEnabled: boolean;
}

export interface DropboxFileReference {
  id: string;
  dropbox_path: string;
  local_id: string;
  created_at?: string;
}
