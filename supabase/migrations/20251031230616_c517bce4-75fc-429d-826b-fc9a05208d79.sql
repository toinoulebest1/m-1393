-- Create enum for session control modes
CREATE TYPE session_control_mode AS ENUM ('host', 'democratic', 'silent');

-- Create enum for session visibility
CREATE TYPE session_visibility AS ENUM ('private', 'public');

-- Create listening_sessions table
CREATE TABLE public.listening_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  control_mode session_control_mode NOT NULL DEFAULT 'host',
  visibility session_visibility NOT NULL DEFAULT 'private',
  join_code TEXT NOT NULL UNIQUE,
  current_song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  current_position REAL NOT NULL DEFAULT 0,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  playback_rate REAL NOT NULL DEFAULT 1.0,
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create session_participants table
CREATE TABLE public.session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.listening_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(session_id, user_id)
);

-- Create session_queue table
CREATE TABLE public.session_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.listening_sessions(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create session_votes table (for democratic mode)
CREATE TABLE public.session_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.listening_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL, -- 'skip', 'pause', 'play'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id, vote_type)
);

-- Create session_messages table (for chat)
CREATE TABLE public.session_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.listening_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.listening_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for listening_sessions
CREATE POLICY "Public sessions are visible to everyone"
ON public.listening_sessions FOR SELECT
USING (visibility = 'public' AND is_active = true);

CREATE POLICY "Participants can view their sessions"
ON public.listening_sessions FOR SELECT
USING (
  id IN (
    SELECT session_id FROM public.session_participants 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Hosts can create sessions"
ON public.listening_sessions FOR INSERT
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their sessions"
ON public.listening_sessions FOR UPDATE
USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their sessions"
ON public.listening_sessions FOR DELETE
USING (auth.uid() = host_id);

-- RLS Policies for session_participants
CREATE POLICY "Participants can view session participants"
ON public.session_participants FOR SELECT
USING (
  session_id IN (
    SELECT session_id FROM public.session_participants 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can join sessions"
ON public.session_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave sessions"
ON public.session_participants FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for session_queue
CREATE POLICY "Participants can view queue"
ON public.session_queue FOR SELECT
USING (
  session_id IN (
    SELECT session_id FROM public.session_participants 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Participants can add to queue"
ON public.session_queue FOR INSERT
WITH CHECK (
  auth.uid() = added_by AND
  session_id IN (
    SELECT session_id FROM public.session_participants 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Host or democratic mode allows queue updates"
ON public.session_queue FOR UPDATE
USING (
  session_id IN (
    SELECT id FROM public.listening_sessions 
    WHERE (host_id = auth.uid() OR control_mode = 'democratic')
  )
);

CREATE POLICY "Host or democratic mode allows queue deletion"
ON public.session_queue FOR DELETE
USING (
  session_id IN (
    SELECT id FROM public.listening_sessions 
    WHERE (host_id = auth.uid() OR control_mode = 'democratic')
  )
);

-- RLS Policies for session_votes
CREATE POLICY "Participants can view votes"
ON public.session_votes FOR SELECT
USING (
  session_id IN (
    SELECT session_id FROM public.session_participants 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Participants can vote"
ON public.session_votes FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  session_id IN (
    SELECT session_id FROM public.session_participants 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can update their votes"
ON public.session_votes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their votes"
ON public.session_votes FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for session_messages
CREATE POLICY "Participants can view messages"
ON public.session_messages FOR SELECT
USING (
  session_id IN (
    SELECT session_id FROM public.session_participants 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Participants can send messages"
ON public.session_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  session_id IN (
    SELECT session_id FROM public.session_participants 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Create indexes for performance
CREATE INDEX idx_listening_sessions_active ON public.listening_sessions(is_active, visibility);
CREATE INDEX idx_session_participants_session ON public.session_participants(session_id, is_active);
CREATE INDEX idx_session_participants_user ON public.session_participants(user_id, is_active);
CREATE INDEX idx_session_queue_session ON public.session_queue(session_id, position);
CREATE INDEX idx_session_votes_session ON public.session_votes(session_id, vote_type);
CREATE INDEX idx_session_messages_session ON public.session_messages(session_id, created_at);

-- Function to generate join code
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
BEGIN
  code := upper(substring(md5(random()::text) from 1 for 6));
  RETURN code;
END;
$$;

-- Add realtime publication for all session tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.listening_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;