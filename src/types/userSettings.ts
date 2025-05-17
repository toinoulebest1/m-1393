
import { Database } from '@/integrations/supabase/types';

export type UserSetting = Database['public']['Tables']['user_settings']['Row'];
export type UserSettingInsert = Database['public']['Tables']['user_settings']['Insert'];
export type UserSettingUpdate = Database['public']['Tables']['user_settings']['Update'];

export interface DropboxConfig {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  expiresAt?: number;
  isEnabled: boolean;
}
