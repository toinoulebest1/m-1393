export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          last_logins: Json[] | null
          signup_date: string | null
          theme: Json | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          last_logins?: Json[] | null
          signup_date?: string | null
          theme?: Json | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_logins?: Json[] | null
          signup_date?: string | null
          theme?: Json | null
          username?: string | null
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
      songs: {
        Row: {
          artist: string | null
          created_at: string
          duration: string | null
          file_path: string
          id: string
          image_url: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          artist?: string | null
          created_at?: string
          duration?: string | null
          file_path: string
          id?: string
          image_url?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          artist?: string | null
          created_at?: string
          duration?: string | null
          file_path?: string
          id?: string
          image_url?: string | null
          title?: string
          uploaded_by?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
