import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayerContext } from './PlayerContext';
import { 
  ListeningSession, 
  SessionParticipant, 
  SessionQueueItem, 
  SessionMessage,
  SessionVote,
  SessionControlMode,
  SessionVisibility
} from '@/types/listeningSession';
import { Song } from '@/types/player';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface ListeningSessionContextType {
  currentSession: ListeningSession | null;
  participants: SessionParticipant[];
  sessionQueue: SessionQueueItem[];
  messages: SessionMessage[];
  votes: SessionVote[];
  isHost: boolean;
  createSession: (name: string, mode: SessionControlMode, visibility: SessionVisibility, initialSongId: string) => Promise<void>;
  joinSession: (joinCode: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  endSession: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  addToSessionQueue: (songId: string) => Promise<void>;
  vote: (voteType: 'skip' | 'pause' | 'play') => Promise<void>;
  hostPlay: () => Promise<void>;
  hostPause: () => Promise<void>;
  hostSeek: (position: number) => Promise<void>;
  hostNext: () => Promise<void>;
  hostChangeSong: (songId: string) => Promise<void>;
}

const ListeningSessionContext = createContext<ListeningSessionContextType | null>(null);

// Export the context for use with useContext
export { ListeningSessionContext };

export const ListeningSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentSong, play, pause, setProgress, getCurrentAudioElement } = usePlayerContext();
  const [currentSession, setCurrentSession] = useState<ListeningSession | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [sessionQueue, setSessionQueue] = useState<SessionQueueItem[]>([]);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [votes, setVotes] = useState<SessionVote[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedPositionRef = useRef<number>(0);

  const isHost = currentSession?.host_id === userId;

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔐 Current user in session context:', user?.id);
      setUserId(user?.id || null);
    };
    
    getCurrentUser();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.id);
      setUserId(session?.user?.id || null);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Synchronization logic - adjust playback to match session
  useEffect(() => {
    if (!currentSession || !currentSong || isHost) return;

    const audioElement = getCurrentAudioElement();
    if (!audioElement || !audioElement.duration) return;

    const targetPosition = currentSession.current_position;
    const currentPosition = audioElement.currentTime;
    const timeDifference = Math.abs(targetPosition - currentPosition);

    // If difference is significant (>0.25s), adjust playback
    if (timeDifference > 0.25) {
      console.log(`🔄 Syncing: target=${targetPosition.toFixed(2)}s, current=${currentPosition.toFixed(2)}s, diff=${timeDifference.toFixed(2)}s`);
      
      if (timeDifference > 2) {
        // Large difference: seek immediately
        audioElement.currentTime = targetPosition;
        const progressPercent = (targetPosition / audioElement.duration) * 100;
        setProgress(progressPercent);
      } else {
        // Small difference: adjust playback rate for smooth sync
        const adjustmentFactor = timeDifference > 0.5 ? 0.05 : 0.02;
        const newRate = targetPosition > currentPosition 
          ? 1 + adjustmentFactor 
          : 1 - adjustmentFactor;
        audioElement.playbackRate = newRate;
        
        // Reset playback rate after sync
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          audioElement.playbackRate = currentSession.playback_rate;
        }, 1000);
      }
    }

    lastSyncedPositionRef.current = targetPosition;
  }, [currentSession?.current_position, currentSong, isHost, getCurrentAudioElement, setProgress]);

  // Sync play/pause state
  useEffect(() => {
    if (!currentSession) return;

    const audioElement = getCurrentAudioElement();
    if (!audioElement) return;

    const shouldPlay = currentSession.is_playing;
    const isCurrentlyPlaying = !audioElement.paused;

    console.log('🎵 Sync check:', {
      shouldPlay,
      isCurrentlyPlaying,
      isHost,
      currentTime: audioElement.currentTime
    });

    if (shouldPlay && !isCurrentlyPlaying) {
      console.log('▶️ Starting playback for participant');
      audioElement.play().catch(e => console.error('Play error:', e));
      
      if (!isHost) {
        toast.info('L\'hôte a repris la lecture');
      }
    } else if (!shouldPlay && isCurrentlyPlaying) {
      console.log('⏸️ Pausing playback for participant');
      audioElement.pause();
      
      if (!isHost) {
        toast.info('L\'hôte a mis le titre en pause');
      }
    }
  }, [currentSession?.is_playing, getCurrentAudioElement, isHost]);

  // Load session song if different (ONLY for participants, NOT for host)
  useEffect(() => {
    if (!currentSession?.current_song_id || isHost) return;
    
    if (!currentSong || currentSong.id !== currentSession.current_song_id) {
      console.log('🎵 Participant loading session song:', currentSession.current_song_id);
      supabase
        .from('songs')
        .select('*')
        .eq('id', currentSession.current_song_id)
        .single()
        .then(({ data }) => {
          if (data) {
            const song: Song = {
              id: data.id,
              title: data.title,
              artist: data.artist || '',
              url: data.file_path,
              imageUrl: data.image_url || undefined,
              duration: data.duration || undefined,
              genre: data.genre || undefined,
              album_name: data.album_name || undefined,
              created_at: data.created_at,
              user_id: data.uploaded_by || undefined
            };
            console.log('🎵 Playing session song:', song.title);
            play(song);
            
            // Wait for audio to load, then sync position and play state
            setTimeout(() => {
              const audioElement = getCurrentAudioElement();
              if (audioElement) {
                // Always sync position
                if (currentSession.current_position > 0) {
                  console.log('⏩ Syncing to session position:', currentSession.current_position);
                  audioElement.currentTime = currentSession.current_position;
                  const progressPercent = (currentSession.current_position / audioElement.duration) * 100;
                  setProgress(progressPercent);
                }
                
                // Force pause first, then play only if session is playing
                audioElement.pause();
                if (currentSession.is_playing) {
                  console.log('▶️ Session is playing, starting playback');
                  audioElement.play().catch(console.error);
                } else {
                  console.log('⏸️ Session is paused, keeping paused');
                }
              }
            }, 1000);
          }
        });
    }
  }, [currentSession?.current_song_id, currentSong, play, getCurrentAudioElement, currentSession?.current_position, currentSession?.is_playing, setProgress, isHost]);

  // Host updates session state based on local playback
  useEffect(() => {
    if (!currentSession || !isHost || !currentSong) return;

    const audioElement = getCurrentAudioElement();
    if (!audioElement) return;

    let lastReportedPlayState = currentSession.is_playing;

    const updateInterval = setInterval(async () => {
      const currentPosition = audioElement.currentTime;
      const isPlaying = !audioElement.paused;

      // Always update position, but only update play state if it changed
      const stateChanged = isPlaying !== lastReportedPlayState;
      
      if (
        Math.abs(currentPosition - lastSyncedPositionRef.current) > 0.5 ||
        stateChanged
      ) {
        console.log('🔄 Host updating session state:', { 
          position: currentPosition, 
          isPlaying,
          stateChanged 
        });
        
        await supabase
          .from('listening_sessions')
          .update({
            current_position: currentPosition,
            is_playing: isPlaying,
            last_sync_at: new Date().toISOString()
          })
          .eq('id', currentSession.id);

        lastSyncedPositionRef.current = currentPosition;
        lastReportedPlayState = isPlaying;
      }
    }, 500);

    return () => clearInterval(updateInterval);
  }, [currentSession, isHost, currentSong, getCurrentAudioElement]);

  // Host auto-updates session when changing song
  useEffect(() => {
    if (!currentSession || !isHost || !currentSong) return;
    
    // If the current song is different from the session's song, update it
    if (currentSong.id !== currentSession.current_song_id) {
      console.log('🎵 Host changed song, updating session:', currentSong.id);
      supabase
        .from('listening_sessions')
        .update({
          current_song_id: currentSong.id,
          current_position: 0,
          is_playing: true,
          last_sync_at: new Date().toISOString()
        })
        .eq('id', currentSession.id);
    }
  }, [currentSong?.id, currentSession, isHost]);

  // Subscribe to session updates via Realtime
  useEffect(() => {
    if (!currentSession) return;

    channelRef.current = supabase
      .channel(`session:${currentSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listening_sessions',
          filter: `id=eq.${currentSession.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setCurrentSession(payload.new as ListeningSession);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=eq.${currentSession.id}`
        },
        () => {
          loadParticipants(currentSession.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_queue',
          filter: `session_id=eq.${currentSession.id}`
        },
        () => {
          loadQueue(currentSession.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_messages',
          filter: `session_id=eq.${currentSession.id}`
        },
        () => {
          loadMessages(currentSession.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_votes',
          filter: `session_id=eq.${currentSession.id}`
        },
        () => {
          loadVotes(currentSession.id);
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [currentSession?.id]);

  const loadParticipants = async (sessionId: string) => {
    const { data: participantsData } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_active', true);
    
    if (participantsData) {
      const participantsWithUsernames = await Promise.all(
        participantsData.map(async (p) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', p.user_id)
            .single();
          
          return {
            ...p,
            username: profile?.username
          } as SessionParticipant;
        })
      );
      setParticipants(participantsWithUsernames);
    }
  };

  const loadQueue = async (sessionId: string) => {
    const { data } = await supabase
      .from('session_queue')
      .select('*')
      .eq('session_id', sessionId)
      .order('position');
    
    if (data) setSessionQueue(data);
  };

  const loadMessages = async (sessionId: string) => {
    const { data: messagesData } = await supabase
      .from('session_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (messagesData) {
      const messagesWithUsernames = await Promise.all(
        messagesData.map(async (m) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', m.user_id)
            .single();
          
          return {
            ...m,
            username: profile?.username
          } as SessionMessage;
        })
      );
      setMessages(messagesWithUsernames);
    }
  };

  const loadVotes = async (sessionId: string) => {
    const { data } = await supabase
      .from('session_votes')
      .select('*')
      .eq('session_id', sessionId);
    
    if (data) setVotes(data as SessionVote[]);
  };

  const createSession = async (
    name: string, 
    mode: SessionControlMode, 
    visibility: SessionVisibility,
    initialSongId: string
  ) => {
    if (!userId) {
      toast.error('Vous devez être connecté');
      return;
    }

    // Generate join code
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: session, error } = await supabase
      .from('listening_sessions')
      .insert({
        host_id: userId,
        name,
        control_mode: mode,
        visibility,
        join_code: joinCode,
        current_song_id: initialSongId,
        current_position: 0,
        is_playing: false
      })
      .select()
      .single();

    if (error || !session) {
      toast.error('Erreur lors de la création de la session');
      return;
    }

    // Add host as participant
    await supabase
      .from('session_participants')
      .insert({
        session_id: session.id,
        user_id: userId
      });

    setCurrentSession(session);
    await loadParticipants(session.id);
    toast.success(`Session créée ! Code : ${joinCode}`);
  };

  const joinSession = async (joinCode: string) => {
    if (!userId) {
      toast.error('Vous devez être connecté');
      return;
    }

    const { data: session, error } = await supabase
      .from('listening_sessions')
      .select('*')
      .eq('join_code', joinCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !session) {
      toast.error('Session introuvable');
      return;
    }

    // Add as participant
    await supabase
      .from('session_participants')
      .insert({
        session_id: session.id,
        user_id: userId
      });

    setCurrentSession(session);
    await loadParticipants(session.id);
    await loadQueue(session.id);
    await loadMessages(session.id);
    
    // Important: Load the current song and sync immediately
    if (session.current_song_id) {
      const { data: songData } = await supabase
        .from('songs')
        .select('*')
        .eq('id', session.current_song_id)
        .single();
      
      if (songData) {
        const song: Song = {
          id: songData.id,
          title: songData.title,
          artist: songData.artist || '',
          url: songData.file_path,
          imageUrl: songData.image_url || undefined,
          duration: songData.duration || undefined,
          genre: songData.genre || undefined,
          album_name: songData.album_name || undefined,
          created_at: songData.created_at,
          user_id: songData.uploaded_by || undefined
        };
        
        play(song);
        
        // Wait for audio to be ready and sync
        setTimeout(() => {
          const audioElement = getCurrentAudioElement();
          if (audioElement) {
            // Sync position
            console.log('⏩ Joining session at position:', session.current_position);
            audioElement.currentTime = session.current_position;
            
            // Force pause first to ensure clean state
            audioElement.pause();
            
            // Then play only if session is playing
            if (session.is_playing) {
              console.log('▶️ Session is playing, starting playback');
              audioElement.play().catch(console.error);
              toast.success('Session rejointe ! Lecture synchronisée');
            } else {
              console.log('⏸️ Session is paused, staying paused');
              toast.success('Session rejointe ! En pause');
            }
          }
        }, 1500);
      }
    } else {
      toast.success('Session rejointe !');
    }
  };

  const leaveSession = async () => {
    if (!currentSession || !userId) return;

    await supabase
      .from('session_participants')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('session_id', currentSession.id)
      .eq('user_id', userId);

    // If host leaves, transfer to next participant or end session
    if (isHost) {
      const nextHost = participants.find(p => p.user_id !== userId);
      if (nextHost && currentSession.control_mode !== 'host') {
        await supabase
          .from('listening_sessions')
          .update({ host_id: nextHost.user_id })
          .eq('id', currentSession.id);
        toast.success('Session transférée au prochain participant');
      } else {
        await supabase
          .from('listening_sessions')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('id', currentSession.id);
        toast.success('Session terminée');
      }
    }

    setCurrentSession(null);
    setParticipants([]);
    setSessionQueue([]);
    setMessages([]);
    setVotes([]);
    
    if (!isHost) {
      toast.success('Session quittée');
    }
  };

  const endSession = async () => {
    if (!currentSession || !isHost) return;

    // End session for everyone
    await supabase
      .from('listening_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', currentSession.id);

    // Mark all participants as left
    await supabase
      .from('session_participants')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('session_id', currentSession.id);

    setCurrentSession(null);
    setParticipants([]);
    setSessionQueue([]);
    setMessages([]);
    setVotes([]);
    
    toast.success('Session supprimée');
  };

  const sendMessage = async (message: string) => {
    if (!currentSession || !userId || currentSession.control_mode === 'silent') return;

    await supabase
      .from('session_messages')
      .insert({
        session_id: currentSession.id,
        user_id: userId,
        message
      });
  };

  const addToSessionQueue = async (songId: string) => {
    if (!currentSession || !userId) return;

    const maxPosition = Math.max(0, ...sessionQueue.map(q => q.position));

    await supabase
      .from('session_queue')
      .insert({
        session_id: currentSession.id,
        song_id: songId,
        added_by: userId,
        position: maxPosition + 1
      });

    toast.success('Ajouté à la file d\'attente');
  };

  const vote = async (voteType: 'skip' | 'pause' | 'play') => {
    if (!currentSession || !userId || currentSession.control_mode !== 'democratic') return;

    await supabase
      .from('session_votes')
      .upsert({
        session_id: currentSession.id,
        user_id: userId,
        vote_type: voteType
      });
  };

  const hostPlay = async () => {
    if (!currentSession || !isHost) return;

    await supabase
      .from('listening_sessions')
      .update({ 
        is_playing: true,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', currentSession.id);

    play();
  };

  const hostPause = async () => {
    if (!currentSession || !isHost) return;

    await supabase
      .from('listening_sessions')
      .update({ 
        is_playing: false,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', currentSession.id);

    pause();
  };

  const hostSeek = async (position: number) => {
    if (!currentSession || !isHost) return;

    await supabase
      .from('listening_sessions')
      .update({ 
        current_position: position,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', currentSession.id);

    const audioElement = getCurrentAudioElement();
    if (audioElement && audioElement.duration) {
      audioElement.currentTime = position;
    }
  };

  const hostNext = async () => {
    if (!currentSession || !isHost || sessionQueue.length === 0) return;

    const nextSong = sessionQueue[0];
    
    await supabase
      .from('listening_sessions')
      .update({
        current_song_id: nextSong.song_id,
        current_position: 0,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', currentSession.id);

    await supabase
      .from('session_queue')
      .delete()
      .eq('id', nextSong.id);
  };

  const hostChangeSong = async (songId: string) => {
    if (!currentSession || !isHost) return;

    await supabase
      .from('listening_sessions')
      .update({
        current_song_id: songId,
        current_position: 0,
        is_playing: false,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', currentSession.id);
  };

  return (
    <ListeningSessionContext.Provider value={{
      currentSession,
      participants,
      sessionQueue,
      messages,
      votes,
      isHost,
      createSession,
      joinSession,
      leaveSession,
      endSession,
      sendMessage,
      addToSessionQueue,
      vote,
      hostPlay,
      hostPause,
      hostSeek,
      hostNext,
      hostChangeSong
    }}>
      {children}
    </ListeningSessionContext.Provider>
  );
};

export const useListeningSession = () => {
  const context = useContext(ListeningSessionContext);
  if (!context) {
    throw new Error('useListeningSession must be used within ListeningSessionProvider');
  }
  return context;
};
