export type SessionControlMode = 'host' | 'democratic' | 'silent';
export type SessionVisibility = 'private' | 'public';

export interface ListeningSession {
  id: string;
  host_id: string;
  name: string;
  control_mode: SessionControlMode;
  visibility: SessionVisibility;
  join_code: string;
  current_song_id: string | null;
  current_position: number;
  is_playing: boolean;
  playback_rate: number;
  last_sync_at: string;
  created_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  is_active: boolean;
  username?: string;
}

export interface SessionQueueItem {
  id: string;
  session_id: string;
  song_id: string;
  added_by: string;
  position: number;
  added_at: string;
}

export interface SessionVote {
  id: string;
  session_id: string;
  user_id: string;
  vote_type: 'skip' | 'pause' | 'play';
  created_at: string;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  user_id: string;
  message: string;
  created_at: string;
  username?: string;
}
