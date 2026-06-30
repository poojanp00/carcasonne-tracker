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
      roster: roster.map(name => ({
        name,
        name_lower: name.toLowerCase(),
        meeple:    null,
        device_id: null,
        claimed:   false,
      })),
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

export async function endSession(sessionId, finalData = null) {
  const patch = { phase: 'ended', ended_at: new Date().toISOString() };
  if (finalData) patch.final_data = finalData;
  return supabase
    .from('party_sessions')
    .update(patch)
    .eq('id', sessionId);
}

export async function deleteSession(sessionId) {
  if (!sessionId) return;
  return supabase
    .from('party_sessions')
    .delete()
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

export async function getSessionById(id) {
  const { data } = await supabase
    .from('party_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  return data || null;
}

// ── Roster-based claims (via SECURITY DEFINER RPCs) ──────────────────────────

export async function claimRosterSlot(sessionId, nameLower, deviceId, meeple) {
  const { data, error } = await supabase
    .rpc('claim_roster_slot', {
      p_session_id: sessionId,
      p_name_lower: nameLower,
      p_device_id:  deviceId,
      p_meeple:     meeple,
    });
  if (error) return { ok: false, reason: 'error' };
  return data; // { ok, reason? }
}

export async function unclaimRosterSlot(sessionId, nameLower) {
  await supabase.rpc('unclaim_roster_slot', {
    p_session_id: sessionId,
    p_name_lower: nameLower,
  });
}

// ── Score events ─────────────────────────────────────────────────────────────

export async function submitEvent({ sessionId, playerName, category, delta, source = 'phone' }) {
  const { error } = await supabase
    .from('score_events')
    .insert({
      session_id: sessionId,
      player_name: playerName,
      category,
      delta,
      source,
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
