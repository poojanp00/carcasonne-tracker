import { useState } from 'react';
import { supabase } from '../data/supabase';

export default function Auth({ onSuccess }) {
  const [mode,     setMode]     = useState('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(null);
  const [notice,   setNotice]   = useState(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    if (mode === 'signup') {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (err) { setError(err.message); return; }
      // Email confirmation required — session won't exist yet
      if (data.user && !data.session) {
        setNotice('Check your email to confirm your account, then sign in.');
        setMode('signin');
        return;
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (err) { setError(err.message); return; }
    }

    onSuccess?.();
  };

  return (
    <div className="app-wrapper" style={{ paddingTop: '2.5rem' }}>
      <div className="section-title">
        <h2>{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
        <div className="section-title-line" />
      </div>

      <div className="tile-card" style={{ maxWidth: '360px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <label className="form-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="form-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
            />
          </div>

          {error  && <p style={{ color: '#DC2626', fontStyle: 'italic', fontSize: '0.88rem', margin: 0 }}>{error}</p>}
          {notice && <p style={{ color: 'var(--stone-gray)', fontStyle: 'italic', fontSize: '0.88rem', margin: 0 }}>{notice}</p>}

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '0.3rem' }}>
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '1.1rem', textAlign: 'center', fontSize: '0.88rem', color: 'var(--stone-gray)', fontFamily: 'Crimson Text, serif' }}>
          {mode === 'signin' ? (
            <>No account?{' '}
              <button type="button" className="btn-ghost" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--earth-brown)', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }}
                onClick={() => { setMode('signup'); setError(null); setNotice(null); }}>
                Create one
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--earth-brown)', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }}
                onClick={() => { setMode('signin'); setError(null); setNotice(null); }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
