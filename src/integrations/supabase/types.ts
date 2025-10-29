export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      dropbox_files: {
        Row: {
          created_at: string
          dropbox_path: string
          id: string
          link_created_at: string | null
          link_expires_at: string | null
          local_id: string
          shared_link: string | null
          storage_provider: string | null
        }
        Insert: {
          created_at?: string
          dropbox_path: string
          id?: string
          link_created_at?: string | null
          link_expires_at?: string | null
          local_id: string
          shared_link?: string | null
          storage_provider?: string | null
        }
        Update: {
          created_at?: string
          dropbox_path?: string
          id?: string
          link_created_at?: string | null
          link_expires_at?: string | null
          local_id?: string
          shared_link?: string | null
          storage_provider?: string | null
        }
        Relationships: []
      }
      favorite_stats: {
        Row: {
          count: number | null
          id: string
          last_updated: string | null
          song_id: string
          user_id: string | null
        }
        Insert: {
          count?: number | null
          id?: string
          last_updated?: string | null
          song_id: string
          user_id?: string | null
        }
        Update: {
          count?: number | null
          id?: string
          last_updated?: string | null
          song_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorite_stats_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_stats_archive: {
        Row: {
          archived_at: string
          count: number | null
          id: string
          period_end: string
          period_start: string
          song_id: string
          user_id: string | null
        }
        Insert: {
          archived_at?: string
          count?: number | null
          id?: string
          period_end: string
          period_start: string
          song_id: string
          user_id?: string | null
        }
        Update: {
          archived_at?: string
          count?: number | null
          id?: string
          period_end?: string
          period_start?: string
          song_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gofile_references: {
        Row: {
          created_at: string
          gofile_url: string
          id: string
          song_id: string
        }
        Insert: {
          created_at?: string
          gofile_url: string
          id?: string
          song_id: string
        }
        Update: {
          created_at?: string
          gofile_url?: string
          id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gofile_references_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_songs: {
        Row: {
          hidden_at: string | null
          hidden_by: string | null
          id: string
          song_id: string
        }
        Insert: {
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          song_id: string
        }
        Update: {
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: true
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_stats: {
        Row: {
          created_at: string | null
          favorite_periods: Json[] | null
          id: string
          peak_hours: Json | null
          total_listening_time: number | null
          tracks_played: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          favorite_periods?: Json[] | null
          id?: string
          peak_hours?: Json | null
          total_listening_time?: number | null
          tracks_played?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          favorite_periods?: Json[] | null
          id?: string
          peak_hours?: Json | null
          total_listening_time?: number | null
          tracks_played?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listening_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lyrics: {
        Row: {
          content: string
          created_at: string
          id: string
          song_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          song_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lyrics_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_notifications: {
        Row: {
          created_at: string
          email: string
          id: string
          subscribed_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          subscribed_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          subscribed_at?: string
        }
        Relationships: []
      }
      music_preferences: {
        Row: {
          audio_quality: string | null
          created_at: string | null
          crossfade_duration: number | null
          crossfade_enabled: boolean | null
          favorite_genres: Json[] | null
          id: string
          preferred_languages: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          audio_quality?: string | null
          created_at?: string | null
          crossfade_duration?: number | null
          crossfade_enabled?: boolean | null
          favorite_genres?: Json[] | null
          id?: string
          preferred_languages?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          audio_quality?: string | null
          created_at?: string | null
          crossfade_duration?: number | null
          crossfade_enabled?: boolean | null
          favorite_genres?: Json[] | null
          id?: string
          preferred_languages?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "music_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          provider: string
          state: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          provider: string
          state: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          state?: string
        }
        Relationships: []
      }
      offline_songs: {
        Row: {
          downloaded_at: string | null
          id: string
          last_played_at: string | null
          song_id: string
          user_id: string
        }
        Insert: {
          downloaded_at?: string | null
          id?: string
          last_played_at?: string | null
          song_id: string
          user_id: string
        }
        Update: {
          downloaded_at?: string | null
          id?: string
          last_played_at?: string | null
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offline_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      onedrive_permanent_links: {
        Row: {
          created_at: string
          file_name: string | null
          file_size: number | null
          id: string
          is_active: boolean
          last_verified_at: string | null
          local_id: string
          permanent_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          last_verified_at?: string | null
          local_id: string
          permanent_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          last_verified_at?: string | null
          local_id?: string
          permanent_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      play_history: {
        Row: {
          id: string
          played_at: string | null
          song_id: string
          user_id: string
        }
        Insert: {
          id?: string
          played_at?: string | null
          song_id: string
          user_id: string
        }
        Update: {
          id?: string
          played_at?: string | null
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_history_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_friends: {
        Row: {
          added_at: string
          friend_user_id: string
          id: string
          playlist_id: string
        }
        Insert: {
          added_at?: string
          friend_user_id: string
          id?: string
          playlist_id: string
        }
        Update: {
          added_at?: string
          friend_user_id?: string
          id?: string
          playlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_friends_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_songs: {
        Row: {
          added_at: string
          id: string
          playlist_id: string
          position: number
          song_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          playlist_id: string
          position: number
          song_id: string
        }
        Update: {
          added_at?: string
          id?: string
          playlist_id?: string
          position?: number
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          last_logins: Json[] | null
          signup_date: string | null
          theme: Json | null
          theme_animation: boolean | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          last_logins?: Json[] | null
          signup_date?: string | null
          theme?: Json | null
          theme_animation?: boolean | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_logins?: Json[] | null
          signup_date?: string | null
          theme?: Json | null
          theme_animation?: boolean | null
          username?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          date: string
          duree: number
          email: string
          google_event_id: string | null
          heure: string
          id: string
          message: string | null
          nom: string
          payment_intent_id: string | null
          payment_status: string
          status: string
          stripe_checkout_session_id: string | null
          telephone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          date: string
          duree: number
          email: string
          google_event_id?: string | null
          heure: string
          id?: string
          message?: string | null
          nom: string
          payment_intent_id?: string | null
          payment_status?: string
          status?: string
          stripe_checkout_session_id?: string | null
          telephone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          date?: string
          duree?: number
          email?: string
          google_event_id?: string | null
          heure?: string
          id?: string
          message?: string | null
          nom?: string
          payment_intent_id?: string | null
          payment_status?: string
          status?: string
          stripe_checkout_session_id?: string | null
          telephone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      secrets: {
        Row: {
          id: string
          name: string
          value: string
        }
        Insert: {
          id?: string
          name: string
          value: string
        }
        Update: {
          id?: string
          name?: string
          value?: string
        }
        Relationships: []
      }
      site_announcements: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      song_reports: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          reporter_username: string | null
          song_artist: string | null
          song_id: string | null
          song_title: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          reporter_username?: string | null
          song_artist?: string | null
          song_id?: string | null
          song_title?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          reporter_username?: string | null
          song_artist?: string | null
          song_id?: string | null
          song_title?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      songs: {
        Row: {
          album_name: string | null
          artist: string | null
          created_at: string
          duration: string | null
          file_path: string
          genre: string | null
          id: string
          image_url: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          album_name?: string | null
          artist?: string | null
          created_at?: string
          duration?: string | null
          file_path: string
          genre?: string | null
          id?: string
          image_url?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          album_name?: string | null
          artist?: string | null
          created_at?: string
          duration?: string | null
          file_path?: string
          genre?: string | null
          id?: string
          image_url?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      top100_reset_history: {
        Row: {
          id: string
          period_end: string
          period_start: string
          reset_at: string
          songs_archived: number
        }
        Insert: {
          id?: string
          period_end: string
          period_start: string
          reset_at?: string
          songs_archived?: number
        }
        Update: {
          id?: string
          period_end?: string
          period_start?: string
          reset_at?: string
          songs_archived?: number
        }
        Relationships: []
      }
      user_announcement_views: {
        Row: {
          announcement_id: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          announcement_id: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          announcement_id?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_announcement_views_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "site_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          ban_type: string
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          reason: string
          user_id: string
        }
        Insert: {
          ban_type: string
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason: string
          user_id: string
        }
        Update: {
          ban_type?: string
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"] | null
          user_id: string | null
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string | null
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_playlist: {
        Args: { playlist_id: string; viewer_user_id: string }
        Returns: boolean
      }
      can_view_playlist_songs: {
        Args: { playlist_id: string; viewer_user_id: string }
        Returns: boolean
      }
      deactivate_expired_bans: { Args: never; Returns: undefined }
      delete_song_completely: {
        Args: { song_id_param: string }
        Returns: boolean
      }
      delete_songs_batch: {
        Args: { song_ids: string[] }
        Returns: {
          deleted_count: number
          errors: string[]
        }[]
      }
      generate_random_username: { Args: never; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_user_banned: { Args: { user_id: string }; Returns: boolean }
    }
    Enums: {
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["admin", "user"],
    },
  },
} as const
