
export interface DropboxConfig {
  accessToken: string;
  isEnabled: boolean;
  authenticating?: boolean;
}

export interface DropboxFileReference {
  id?: string;
  local_id: string;
  dropbox_path: string;
  created_at?: string;
}
