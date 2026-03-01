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

// ── Default realm + games seed ────────────────────────────────────────────────
// Edit DEFAULT_REALM and DEFAULT_GAMES here — every new signup gets a copy.

const DEFAULT_REALM = {
  name:    'Mont Shastaire',
  players: ['Dielle', 'Jorian'],
};

const DEFAULT_GAMES = [
  { date: '2026-03-01', clutchWin: false, farmWin: true,  expansions: ['The Abbot','The River'], players: [{ name: 'Dielle', score: 3, meeple: '1yellow.png', breakdown: { city: 0, road: 0, field: 3, monastery: 0 } }, { name: 'Jorien', score: 0, meeple: '2pink.png', breakdown: { city: 0, road: 0, field: 0, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: true,  expansions: ['Inns & Cathedrals','The Abbot','The River','Traders & Builders'], players: [{ name: 'Dielle', score: 50, meeple: 'fun/lightning.png', breakdown: { pig: 2, city: 3, road: 0, wine: 10, cloth: 10, field: 3, cathedral: 14, monastery: 8 } }, { name: 'Jorien', score: 54, meeple: 'fun/gamakichi.png', breakdown: { inn: 3, pig: 13, city: 5, road: 4, field: 10, grain: 10, monastery: 9 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['Abbey & Mayor','The Abbot','The River'], players: [{ name: 'Dielle', score: 3, meeple: 'fun/naruto.png', breakdown: { city: 0, road: 0, field: 0, monastery: 3 } }, { name: 'Jorien', score: 3, meeple: 'fun/lightning.png', breakdown: { city: 0, road: 3, field: 0, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['Inns & Cathedrals','The Abbot','The River'], players: [{ name: 'Dielle', score: 53, meeple: 'fun/lightning.png', breakdown: { city: 18, road: 5, field: 9, cathedral: 21, monastery: 0 } }, { name: 'Jorien', score: 41, meeple: 'fun/gamakichi.png', breakdown: { inn: 8, city: 6, road: 14, field: 13, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: true,  expansions: ['The Abbot','The River'], players: [{ name: 'Dielle', score: 3, meeple: '1yellow.png', breakdown: { city: 0, road: 0, field: 3, monastery: 0 } }, { name: 'Jorien', score: 12, meeple: '2pink.png', breakdown: { city: 0, road: 0, field: 12, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['The Abbot','The River'], players: [{ name: 'Dielle', score: 26, meeple: 'fun/shasta.png', breakdown: { city: 10, road: 4, field: 6, monastery: 6 } }, { name: 'Jorien', score: 24, meeple: 'fun/poojan.png', breakdown: { city: 6, road: 0, field: 0, monastery: 18 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: true,  expansions: ['The Abbot','The River'], players: [{ name: 'Dielle', score: 19, meeple: 'fun/shasta.png', breakdown: { city: 10, road: 0, field: 0, monastery: 9 } }, { name: 'Jorien', score: 22, meeple: 'fun/gamakichi.png', breakdown: { city: 8, road: 2, field: 12, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['The Abbot','The River'], players: [{ name: 'Dielle', score: 583, meeple: '1yellow.png', breakdown: { city: 6, road: 256, field: 0, monastery: 321 } }, { name: 'Jorien', score: 598, meeple: '2pink.png', breakdown: { city: 235, road: 19, field: 0, monastery: 344 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: true,  expansions: ['The Abbot','The River','Traders & Builders'], players: [{ name: 'Dielle', score: 24, meeple: '1yellow.png', breakdown: { pig: 4, city: 0, road: 0, wine: 10, field: 0, grain: 10, monastery: 0 } }, { name: 'Jorien', score: 14, meeple: '2pink.png', breakdown: { pig: 4, city: 0, road: 0, cloth: 10, field: 0, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: true,  expansions: ['The Abbot','The River','Traders & Builders'], players: [{ name: 'Dielle', score: 6, meeple: '1yellow.png', breakdown: { city: 0, road: 0, field: 0, monastery: 6 } }, { name: 'Jorien', score: 36, meeple: '2pink.png', breakdown: { city: 0, road: 0, wine: 10, cloth: 10, field: 0, grain: 10, monastery: 6 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['Inns & Cathedrals','The Abbot','The River'], players: [{ name: 'Dielle', score: 43, meeple: '1yellow.png', breakdown: { inn: 10, city: 0, road: 0, field: 0, cathedral: 33, monastery: 0 } }, { name: 'Jorien', score: 20, meeple: '2pink.png', breakdown: { inn: 20, city: 0, road: 0, field: 0, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: true,  expansions: ['The Abbot','The River','Traders & Builders'], players: [{ name: 'Dielle', score: 46, meeple: '1yellow.png', breakdown: { pig: 8, city: 4, road: 6, wine: 10, field: 0, grain: 10, monastery: 8 } }, { name: 'Jorien', score: 36, meeple: 'fun/lightning.png', breakdown: { city: 0, road: 12, field: 12, monastery: 12 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: true,  expansions: ['The Abbot','The River'], players: [{ name: 'Dielle', score: 9, meeple: '1yellow.png', breakdown: { city: 9, road: 0, field: 0, monastery: 0 } }, { name: 'Jorien', score: 16, meeple: '2pink.png', breakdown: { city: 0, road: 0, field: 8, monastery: 8 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['The Abbot','The River'], players: [{ name: 'Dielle', score: 200, meeple: '1yellow.png', breakdown: { city: 200, road: 0, field: 0, monastery: 0 } }, { name: 'Jorien', score: 300, meeple: '2pink.png', breakdown: { city: 300, road: 0, field: 0, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['Abbey & Mayor','The Abbot','The River'], players: [{ name: 'Dielle', score: 89, meeple: 'fun/lightning.png', breakdown: { city: 0, road: 89, field: 0, monastery: 0 } }, { name: 'Jorien', score: 0, meeple: 'fun/poojan.png', breakdown: { city: 0, road: 0, field: 0, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: true,  farmWin: true,  expansions: ['The Abbot','The River'], players: [{ name: 'Dielle', score: 18, meeple: 'fun/lightning.png', breakdown: { city: 0, road: 0, field: 3, monastery: 15 } }, { name: 'Jorien', score: 17, meeple: 'fun/shasta.png', breakdown: { city: 3, road: 0, field: 0, monastery: 14 } }] },
  { date: '2026-03-01', clutchWin: true,  farmWin: true,  expansions: ['The Abbot','The River'], players: [{ name: 'Dielle', score: 27, meeple: 'fun/poojan.png', breakdown: { city: 27, road: 0, field: 0, monastery: 0 } }, { name: 'Jorien', score: 28, meeple: 'fun/lightning.png', breakdown: { city: 8, road: 0, field: 20, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: true,  farmWin: true,  expansions: ['Inns & Cathedrals','The Abbot','The River'], players: [{ name: 'Dielle', score: 49, meeple: 'fun/shasta.png', breakdown: { inn: 0, city: 33, road: 16, field: 0, cathedral: 0, monastery: 0 } }, { name: 'Jorien', score: 42, meeple: 'fun/lightning.png', breakdown: { inn: 0, city: 0, road: 0, field: 0, cathedral: 30, monastery: 12 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['Inns & Cathedrals','The Abbot','The River'], players: [{ name: 'Dielle', score: 198, meeple: 'fun/poojan.png', breakdown: { inn: 30, city: 75, road: 0, field: 0, cathedral: 28, monastery: 65 } }, { name: 'Jorien', score: 97, meeple: 'fun/sasuke.png', breakdown: { inn: 0, city: 0, road: 67, field: 30, cathedral: 0, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['Inns & Cathedrals','The Abbot','The River'], players: [{ name: 'Dielle', score: 76, meeple: 'fun/poojan.png', breakdown: { inn: 6, city: 16, road: 45, field: 0, cathedral: 0, monastery: 9 } }, { name: 'Jorien', score: 106, meeple: 'fun/shasta.png', breakdown: { inn: 0, city: 30, road: 76, field: 0, cathedral: 0, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['Inns & Cathedrals','The Abbot','The River'], players: [{ name: 'Dielle', score: 94, meeple: 'fun/sasuke.png', breakdown: { inn: 12, city: 25, road: 31, field: 0, cathedral: 26, monastery: 0 } }, { name: 'Jorien', score: 147, meeple: 'fun/poojan.png', breakdown: { inn: 6, city: 36, road: 30, field: 15, cathedral: 24, monastery: 36 } }] },
  { date: '2026-03-01', clutchWin: true,  farmWin: true,  expansions: ['Inns & Cathedrals','The Abbot','The River'], players: [{ name: 'Dielle', score: 95, meeple: 'fun/gamakichi.png', breakdown: { inn: 0, city: 39, road: 41, field: 0, cathedral: 0, monastery: 15 } }, { name: 'Jorien', score: 100, meeple: 'fun/naruto.png', breakdown: { inn: 6, city: 48, road: 14, field: 12, cathedral: 12, monastery: 8 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['Inns & Cathedrals','The Abbot','The River'], players: [{ name: 'Dielle', score: 125, meeple: 'fun/shasta.png', breakdown: { inn: 0, city: 54, road: 15, field: 24, cathedral: 0, monastery: 32 } }, { name: 'Jorien', score: 90, meeple: 'fun/queen.png', breakdown: { inn: 21, city: 45, road: 0, field: 0, cathedral: 24, monastery: 0 } }] },
  { date: '2026-03-01', clutchWin: false, farmWin: false, expansions: ['Inns & Cathedrals','The Abbot','The River','Traders & Builders'], players: [{ name: 'Dielle', score: 140, meeple: 'fun/poojan.png', breakdown: { inn: 0, pig: 0, city: 32, road: 45, wine: 10, cloth: 0, field: 16, grain: 10, cathedral: 0, monastery: 27 } }, { name: 'Jorien', score: 109, meeple: 'fun/queen.png', breakdown: { inn: 24, pig: 20, city: 31, road: 0, wine: 0, cloth: 10, field: 0, grain: 0, cathedral: 24, monastery: 0 } }] },
];

export async function seedDefaultRealm(userId) {
  if (!userId) return;
  const FLAG = 'carcassonne_default_realm_v1';
  if (localStorage.getItem(FLAG)) return;

  const realmId = generateRealmId();
  await saveRealm({
    id:           realmId,
    name:         DEFAULT_REALM.name,
    players:      DEFAULT_REALM.players,
    createdAt:    new Date().toISOString().split('T')[0],
    passwordHash: null,
  }, userId);

  for (const g of DEFAULT_GAMES) {
    await supabase.from('games').insert({
      id:         generateId(),
      realm_id:   realmId,
      date:       g.date,
      players:    g.players,
      expansions: g.expansions || [],
      clutch_win: g.clutchWin  || false,
      farm_win:   g.farmWin    || false,
    });
  }

  localStorage.setItem(FLAG, '1');
}

// ── Realms ────────────────────────────────────────────────────────────────────
// Schema requires: ALTER TABLE realms ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

export async function getRealms(userId) {
  if (!userId) return [];
  const { data } = await supabase.from('realms').select('*').eq('user_id', userId).order('created_at');
  return (data || []).map(r => ({
    id:           r.id,
    name:         r.name,
    players:      r.players || [],
    createdAt:    r.created_at,
    passwordHash: r.password_hash || null,
  }));
}

export async function saveRealm(realm, userId) {
  await supabase.from('realms').upsert({
    id:            realm.id,
    name:          realm.name,
    players:       realm.players || [],
    created_at:    realm.createdAt,
    password_hash: realm.passwordHash || null,
    user_id:       userId || null,
  });
}

export async function deleteRealm(realmId) {
  await supabase.from('games').delete().eq('realm_id', realmId);
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
    clutchWin:  g.clutch_win || false,
    farmWin:    g.farm_win   || false,
  }));
}

export async function insertGame(game) {
  await supabase.from('games').insert({
    id:          game.id,
    realm_id:    game.realmId  || null,
    date:        game.date,
    players:     game.players,
    expansions:  game.expansions || [],
    clutch_win:  game.clutchWin  || false,
    farm_win:    game.farmWin    || false,
  });
}

export async function removeGame(id) {
  await supabase.from('games').delete().eq('id', id);
}

// ── Expansions ────────────────────────────────────────────────────────────────
// Schema requires:
//   ALTER TABLE expansions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
//   ALTER TABLE expansions ADD CONSTRAINT expansions_name_user_id_key UNIQUE (name, user_id);

export async function getExpansions(userId) {
  if (!userId) return DEFAULT_EXPANSIONS;
  const { data } = await supabase.from('expansions').select('*').eq('user_id', userId);
  if (!data || data.length === 0) return DEFAULT_EXPANSIONS;
  const defaultByName = Object.fromEntries(DEFAULT_EXPANSIONS.map(e => [e.name, e]));
  const storedNames   = new Set(data.map(e => e.name));
  return [
    ...data.map(e => ({ name: e.name, type: e.type || defaultByName[e.name]?.type || 'full', owned: e.owned })),
    ...DEFAULT_EXPANSIONS.filter(e => !storedNames.has(e.name)),
  ];
}

export async function upsertExpansion(name, type, owned, userId) {
  await supabase.from('expansions').upsert(
    { name, type, owned, user_id: userId || null },
    { onConflict: 'name,user_id' }
  );
}

// ── localStorage migration (runs once on first load) ─────────────────────────

export async function migrateFromLocalStorage(userId) {
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
            user_id:    userId || null,
          }))
        );
      }
    }

    if (rawGames) {
      const games = JSON.parse(rawGames);
      for (const g of games) {
        if (!Array.isArray(g.players)) continue;
        await supabase.from('games').upsert({
          id:         g.id,
          realm_id:   g.realmId || null,
          date:       g.date,
          players:    g.players,
          expansions: g.expansions || [],
          farm_win:   g.farmWin || false,
        });
      }
    }

    if (rawExpansions) {
      const exps = JSON.parse(rawExpansions);
      if (exps.length > 0) {
        await supabase.from('expansions').upsert(
          exps.map(e => ({ name: e.name, type: e.type || 'full', owned: e.owned || false, user_id: userId || null })),
          { onConflict: 'name,user_id' }
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
