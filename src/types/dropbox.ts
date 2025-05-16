
export interface DropboxConfig {
  accessToken: string;
  isEnabled: boolean;
  authenticating?: boolean;
  refreshToken?: string;
  expiresAt?: string; // Date ISO string
}

export interface DropboxFileReference {
  id?: string;
  local_id: string;
  dropbox_path: string;
  created_at?: string;
}

export interface DropboxTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  account_id?: string;
}
