import { useState, useEffect } from 'react';
import { supabase } from '../data/supabase';

export function useAuth() {
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest,     setIsGuest]     = useState(false);
  const [guestUserId, setGuestUserId] = useState(null);

  useEffect(() => {
    // Check if we're in recovery mode before setting user
    const isRecoveryMode = sessionStorage.getItem('isRecoveryMode') === 'true';
    
    // Resolve existing session immediately
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Don't set user if we're in recovery mode, even if there's a session
      if (!isRecoveryMode) {
        let sessionUser = session?.user ?? null;
        // The cached session snapshots user_metadata at sign-in time; fetch
        // the authoritative user so metadata changes (e.g. display_name
        // backfills) show up without needing to sign out and back in.
        if (session) {
          const { data } = await supabase.auth.getUser();
          if (data?.user) sessionUser = data.user;
        }
        setUser(sessionUser);
      }
      setAuthLoading(false);
    });

    // Keep in sync with sign in / sign out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't set user during recovery mode
      const currentRecoveryMode = sessionStorage.getItem('isRecoveryMode') === 'true';
      if (!currentRecoveryMode) {
        setUser(session?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = () => supabase.auth.signOut();
  
  const enableGuestMode = () => {
    setIsGuest(true);
    setGuestUserId(crypto.randomUUID()); // Generate temp session UUID for board state saving
    setAuthLoading(false);
  };

  const signOutGuest = () => {
    setIsGuest(false);
    setGuestUserId(null);
  };
  
  const completeRecovery = async () => {
    // Clear recovery mode and refresh user session
    sessionStorage.removeItem('isRecoveryMode');
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
  };

  return { user, authLoading, signOut, completeRecovery, isGuest, enableGuestMode, signOutGuest, guestUserId };
}
