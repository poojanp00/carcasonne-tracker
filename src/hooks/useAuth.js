import { useState, useEffect } from 'react';
import { supabase } from '../data/supabase';

export function useAuth() {
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Check if we're in recovery mode before setting user
    const isRecoveryMode = sessionStorage.getItem('isRecoveryMode') === 'true';
    
    // Resolve existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Don't set user if we're in recovery mode, even if there's a session
      if (!isRecoveryMode) {
        setUser(session?.user ?? null);
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
  
  const completeRecovery = async () => {
    // Clear recovery mode and refresh user session
    sessionStorage.removeItem('isRecoveryMode');
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
  };

  return { user, authLoading, signOut, completeRecovery };
}
