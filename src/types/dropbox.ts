
export interface DropboxConfig {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  expiresAt?: number;
  isEnabled: boolean;
}

export interface DropboxFileReference {
  id: string;
  dropbox_path: string;
  local_id: string;
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
