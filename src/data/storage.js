import { supabase } from './supabase';
import { DEFAULT_EXPANSIONS } from './expansions';

export function generateRealmId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function hashPassword(password) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Realms ────────────────────────────────────────────────────────────────────

export async function getRealms() {
  const { data } = await supabase.from('realms').select('*').order('created_at');
  return (data || []).map(r => ({
    id:           r.id,
    name:         r.name,
    players:      r.players || [],
    createdAt:    r.created_at,
    passwordHash: r.password_hash || null,
  }));
}

export async function saveRealm(realm) {
  await supabase.from('realms').upsert({
    id:            realm.id,
    name:          realm.name,
    players:       realm.players || [],
    created_at:    realm.createdAt,
    password_hash: realm.passwordHash || null,
  });
}

export async function deleteRealm(realmId) {
  const { data: games } = await supabase.from('games').select('id').eq('realm_id', realmId);
  if (games?.length) {
    await supabase.storage.from('game-photos').remove(games.map(g => `${g.id}.jpg`));
    await supabase.from('games').delete().eq('realm_id', realmId);
  }
  await supabase.from('realms').delete().eq('id', realmId);
}

// ── Games ─────────────────────────────────────────────────────────────────────

export async function getGames() {
  const { data } = await supabase
    .from('games')
    .select('*')
    .order('inserted_at', { ascending: false });
  return (data || []).map(g => ({
    id:         g.id,
    realmId:    g.realm_id,
    date:       g.date,
    players:    g.players    || [],
    expansions: g.expansions || [],
    photo:      g.photo      || null,
    farmWin:    g.farm_win   || false,
  }));
}

export async function insertGame(game) {
  let photo = game.photo || null;
  if (photo?.startsWith('data:')) {
    photo = await uploadPhoto(game.id, photo);
  }
  await supabase.from('games').insert({
    id:         game.id,
    realm_id:   game.realmId || null,
    date:       game.date,
    players:    game.players,
    expansions: game.expansions || [],
    photo,
    farm_win:   game.farmWin || false,
  });
}

export async function removeGame(id) {
  await supabase.storage.from('game-photos').remove([`${id}.jpg`]);
  await supabase.from('games').delete().eq('id', id);
}

async function uploadPhoto(gameId, base64) {
  try {
    const blob = await fetch(base64).then(r => r.blob());
    const path = `${gameId}.jpg`;
    await supabase.storage.from('game-photos').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    const { data: { publicUrl } } = supabase.storage.from('game-photos').getPublicUrl(path);
    return publicUrl;
  } catch (err) {
    console.warn('Photo upload failed, storing inline:', err);
    return base64;
  }
}

// ── Expansions ────────────────────────────────────────────────────────────────

export async function getExpansions() {
  const { data } = await supabase.from('expansions').select('*');
  if (!data || data.length === 0) return DEFAULT_EXPANSIONS;
  const defaultByName = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e]));
  const storedNames   = new Set(data.map(e => e.name));
  return [
    ...data.map(e => ({ name: e.name, type: e.type || defaultByName[e.name]?.type || 'full', owned: e.owned })),
    ...DEFAULT_EXPANSIONS.filter(e => !storedNames.has(e.name)),
  ];
}

export async function upsertExpansion(name, type, owned) {
  await supabase.from('expansions').upsert({ name, type, owned });
}

// ── localStorage migration (runs once on first load) ─────────────────────────

export async function migrateFromLocalStorage() {
  const LS_MIGRATED = 'carcassonne_migrated_v1';
  if (localStorage.getItem(LS_MIGRATED)) return;

  const LS_REALMS     = 'carcassonne_realms';
  const LS_GAMES      = 'carcassonne_games';
  const LS_EXPANSIONS = 'carcassonne_expansions';
  const LS_BOARD      = 'carcassonne_board_v1';

  try {
    const rawRealms     = localStorage.getItem(LS_REALMS);
    const rawGames      = localStorage.getItem(LS_GAMES);
    const rawExpansions = localStorage.getItem(LS_EXPANSIONS);
    const rawBoard      = localStorage.getItem(LS_BOARD);

    if (rawRealms) {
      const realms = JSON.parse(rawRealms);
      if (realms.length > 0) {
        await supabase.from('realms').upsert(
          realms.map(r => ({
            id:         r.id,
            name:       r.name,
            players:    r.players || [],
            created_at: r.createdAt || new Date().toISOString().split('T')[0],
          }))
        );
      }
    }

    if (rawGames) {
      const games = JSON.parse(rawGames);
      for (const g of games) {
        if (!Array.isArray(g.players)) continue;
        let photo = g.photo || null;
        if (photo?.startsWith('data:')) photo = await uploadPhoto(g.id, photo);
        await supabase.from('games').upsert({
          id:         g.id,
          realm_id:   g.realmId || null,
          date:       g.date,
          players:    g.players,
          expansions: g.expansions || [],
          photo,
          farm_win:   g.farmWin || false,
        });
      }
    }

    if (rawExpansions) {
      const exps = JSON.parse(rawExpansions);
      if (exps.length > 0) {
        await supabase.from('expansions').upsert(
          exps.map(e => ({ name: e.name, type: e.type || 'full', owned: e.owned || false }))
        );
      }
    }

    if (rawBoard) {
      const b = JSON.parse(rawBoard);
      await supabase.from('board_state').upsert({
        id:           1,
        positions:    b.positions    || {},
        laps:         b.laps         || {},
        track_length: b.trackLength  || 50,
        players:      b.players      || [],
      });
    }

    localStorage.setItem(LS_MIGRATED, '1');
    [LS_REALMS, LS_GAMES, LS_EXPANSIONS, LS_BOARD].forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('localStorage migration error:', err);
  }
}
