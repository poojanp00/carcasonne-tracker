import { useState } from 'react';
import { supabase } from '../data/supabase';

const EyeOpen = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeClosed = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const EyeBtn = ({ show, onToggle }) => (
  <button
    type="button"
    tabIndex={-1}
    onClick={onToggle}
    style={{
      position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--stone-gray)', padding: 0, display: 'flex', alignItems: 'center',
    }}
  >
    {show ? <EyeOpen /> : <EyeClosed />}
  </button>
);

export default function Auth({ onSuccess }) {
  const [mode,    setMode]    = useState('signin');  // 'signin' | 'signup'
  const [email,   setEmail]   = useState('');
  const [pw,      setPw]      = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const [showCf,  setShowCf]  = useState(false);
  const [error,   setError]   = useState(null);
  const [notice,  setNotice]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const switchMode = (m) => {
    setMode(m);setForgotMode(false);
    setError(null); setNotice(null);
    setPw(''); setConfirm('');
    setShowPw(false); setShowCf(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setNotice(null);

    if (mode === 'signup' && pw !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    if (mode === 'signup') {
      const { data, error: err } = await supabase.auth.signUp({ email, password: pw });
      setLoading(false);
      if (err) {
        const errorMsg = err.message.toLowerCase();
        if (errorMsg.includes('already registered') || 
            errorMsg.includes('already exists') || 
            errorMsg.includes('user already') ||
            errorMsg.includes('email already') ||
            errorMsg.includes('duplicate')) {
          setError('An account with this email already exists.');
          switchMode('signin');
        } else {
          setError(err.message);
        }
        return;
      }
      if (data.user && !data.session) {
        setNotice('Check your email to confirm your account, then sign in.');
        switchMode('signin');
        return;
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password: pw });
      setLoading(false);
      if (err) { setError(err.message); return; }
    }

    onSuccess?.();
  };
  const handleResetPassword = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setForgotMode(false); // return to normal sign in
  };

  const handleSendMagicLink = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setForgotMode(false); // return to normal sign in
  };

  const linkStyle = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--earth-brown)', fontFamily: 'inherit', fontSize: 'inherit',
    textDecoration: 'underline', padding: 0,
  };

  return (
    <div className="app-wrapper" style={{ paddingTop: '2.5rem' }}>
      <div className="section-title">
        <h2>{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
        <div className="section-title-line" />
      </div>

      <div className="tile-card" style={{ maxWidth: '360px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

          {/* Name was intentionally removed: we no longer collect full name on signup */}

          {/* Email */}
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
              autoFocus={mode === 'signin'}
            />
          </div>

          {/* Password */}
          <div>
            <label className="form-label" htmlFor="auth-pw">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-pw"
                className="form-input"
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                style={{ paddingRight: '2.4rem' }}
              />
              <EyeBtn show={showPw} onToggle={() => setShowPw(v => !v)} />
            </div>
          </div>

          {/* Forgot password link moved to footer row */}

          {/* Confirm (signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="form-label" htmlFor="auth-confirm">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="auth-confirm"
                  className="form-input"
                  type={showCf ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={6}
                  style={{ paddingRight: '2.4rem' }}
                />
                <EyeBtn show={showCf} onToggle={() => setShowCf(v => !v)} />
              </div>
            </div>
          )}

          {error  && <p style={{ color: '#DC2626', fontStyle: 'italic', fontSize: '0.88rem', margin: 0 }}>{error}</p>}
          {notice && <p style={{ color: 'var(--stone-gray)', fontStyle: 'italic', fontSize: '0.88rem', margin: 0 }}>{notice}</p>}

          {mode === 'signin' && forgotMode ? (
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem' }}>
              <button
                type="button"
                className="btn"
                disabled={loading}
                onClick={handleResetPassword}
                style={{ flex: 1 }}
              >
                {loading ? 'Please wait...' : 'Reset password'}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                disabled={loading}
                onClick={handleSendMagicLink}
                style={{ flex: 1 }}
              >
                {loading ? 'Please wait...' : 'One-time link'}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              className="btn"
              disabled={loading}
              style={{ marginTop: '0.3rem' }}
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          )}
        </form>

        <div style={{ marginTop: '1.1rem', fontSize: '0.88rem', color: 'var(--stone-gray)', fontFamily: 'Crimson Text, serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {mode === 'signin' ? (
              <>No account?{' '}<button type="button" style={linkStyle} onClick={() => switchMode('signup')}>Create one</button></>
            ) : (
              <>Already have an account?{' '}<button type="button" style={linkStyle} onClick={() => switchMode('signin')}>Sign in</button></>
            )}
          </div>
          <div>
            {mode === 'signin' && (
              <button type="button" style={linkStyle} onClick={() => { setForgotMode(true); setError(null); }} disabled={loading} > Forgot password? </button>)}
          </div>
        </div>
      </div>
    </div>
  );
}
