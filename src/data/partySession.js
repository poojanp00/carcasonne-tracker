import { supabase } from './supabase';
import { CODE_WORDS } from './wordList';

// ── Code generation ──────────────────────────────────────────────────────────

export async function generateCode() {
  const { data: existing } = await supabase
    .from('party_sessions')
    .select('code')
    .neq('phase', 'ended');

  const taken = new Set((existing || []).map(r => r.code));
  const available = CODE_WORDS.filter(w => !taken.has(w));

  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  // Fallback: random 6-char alphanumeric
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Session management ───────────────────────────────────────────────────────

export async function createSession({ runnerUserId, roster, expansions }) {
  const code = await generateCode();
  const { data, error } = await supabase
    .from('party_sessions')
    .insert({
      code,
      runner_user_id: runnerUserId,
      phase: 'lobby',
      roster: roster.map(name => ({ name })),
      expansions,
    })
    .select('id, code')
    .single();

  if (error) throw error;
  return data; // { id, code }
}

export async function setPhase(sessionId, phase) {
  return supabase
    .from('party_sessions')
    .update({ phase, last_active_at: new Date().toISOString() })
    .eq('id', sessionId);
}

export async function endSession(sessionId) {
  return supabase
    .from('party_sessions')
    .update({ phase: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId);
}

// ── Phone: look up session ───────────────────────────────────────────────────

export async function getSessionByCode(code) {
  const { data } = await supabase
    .from('party_sessions')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .neq('phase', 'ended')
    .maybeSingle();

  return data || null;
}

// ── Claims ───────────────────────────────────────────────────────────────────

export async function getClaimsForSession(sessionId) {
  const { data } = await supabase
    .from('session_claims')
    .select('*')
    .eq('session_id', sessionId);
  return data || [];
}

export async function claimName(sessionId, playerName, deviceId, meeple) {
  // Check if name already claimed
  const { data: existing } = await supabase
    .from('session_claims')
    .select('id, device_id')
    .eq('session_id', sessionId)
    .ilike('player_name', playerName.trim())
    .maybeSingle();

  if (existing) {
    if (existing.device_id === deviceId) {
      // Same device rejoining — update meeple
      await supabase
        .from('session_claims')
        .update({ meeple, last_seen_at: new Date().toISOString() })
        .eq('id', existing.id);
      return { ok: true, claimId: existing.id };
    }
    return { ok: false, reason: 'taken' };
  }

  const { data, error } = await supabase
    .from('session_claims')
    .insert({ session_id: sessionId, player_name: playerName.trim(), meeple, device_id: deviceId })
    .select('id')
    .single();

  if (error) return { ok: false, reason: 'error' };
  return { ok: true, claimId: data.id };
}

// ── Score events ─────────────────────────────────────────────────────────────

export async function submitEvent({ sessionId, playerName, category, delta }) {
  const { error } = await supabase
    .from('score_events')
    .insert({
      session_id: sessionId,
      player_name: playerName,
      category,
      delta,
      submitted_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function fetchNewEvents(sessionId, afterSeq = 0) {
  const { data } = await supabase
    .from('score_events')
    .select('*')
    .eq('session_id', sessionId)
    .gt('seq', afterSeq)
    .order('seq', { ascending: true });
  return data || [];
}

// ── Realtime subscriptions ───────────────────────────────────────────────────

export function subscribeSession(sessionId, cb) {
  return supabase
    .channel(`party-session-${sessionId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'party_sessions',
      filter: `id=eq.${sessionId}`,
    }, payload => cb(payload.new))
    .subscribe();
}

export function subscribeClaims(sessionId, cb) {
  return supabase
    .channel(`party-claims-${sessionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'session_claims',
      filter: `session_id=eq.${sessionId}`,
    }, () => cb()) // caller re-fetches claims on any change
    .subscribe();
}

export function subscribeEvents(sessionId, cb) {
  return supabase
    .channel(`party-events-${sessionId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'score_events',
      filter: `session_id=eq.${sessionId}`,
    }, payload => cb(payload.new))
    .subscribe();
}

export function unsubscribe(channel) {
  if (channel) supabase.removeChannel(channel);
}

// ── Device identity (phone side) ─────────────────────────────────────────────

export function getDeviceId() {
  let id = localStorage.getItem('party_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('party_device_id', id);
  }
  return id;
}
