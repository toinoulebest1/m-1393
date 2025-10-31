-- Drop existing problematic policies
DROP POLICY IF EXISTS "Participants can view session participants" ON public.session_participants;
DROP POLICY IF EXISTS "Participants can view their sessions" ON public.listening_sessions;
DROP POLICY IF EXISTS "Participants can view queue" ON public.session_queue;
DROP POLICY IF EXISTS "Participants can add to queue" ON public.session_queue;
DROP POLICY IF EXISTS "Participants can view votes" ON public.session_votes;
DROP POLICY IF EXISTS "Participants can vote" ON public.session_votes;
DROP POLICY IF EXISTS "Participants can view messages" ON public.session_messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.session_messages;

-- Create security definer function to check if user is participant
CREATE OR REPLACE FUNCTION public.is_session_participant(session_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_participants
    WHERE session_id = session_id_param
      AND user_id = user_id_param
      AND is_active = true
  )
$$;

-- Recreate policies using the security definer function

-- listening_sessions policies
CREATE POLICY "Participants can view their sessions"
ON public.listening_sessions FOR SELECT
USING (public.is_session_participant(id, auth.uid()));

-- session_participants policies
CREATE POLICY "Participants can view session participants"
ON public.session_participants FOR SELECT
USING (public.is_session_participant(session_id, auth.uid()));

-- session_queue policies
CREATE POLICY "Participants can view queue"
ON public.session_queue FOR SELECT
USING (public.is_session_participant(session_id, auth.uid()));

CREATE POLICY "Participants can add to queue"
ON public.session_queue FOR INSERT
WITH CHECK (
  auth.uid() = added_by AND
  public.is_session_participant(session_id, auth.uid())
);

-- session_votes policies
CREATE POLICY "Participants can view votes"
ON public.session_votes FOR SELECT
USING (public.is_session_participant(session_id, auth.uid()));

CREATE POLICY "Participants can vote"
ON public.session_votes FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  public.is_session_participant(session_id, auth.uid())
);

-- session_messages policies
CREATE POLICY "Participants can view messages"
ON public.session_messages FOR SELECT
USING (public.is_session_participant(session_id, auth.uid()));

CREATE POLICY "Participants can send messages"
ON public.session_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  public.is_session_participant(session_id, auth.uid())
);