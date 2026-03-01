import { useState, useCallback, useEffect } from 'react';
import {
  getGames, insertGame, removeGame,
  getExpansions, upsertExpansion,
  getRealms, saveRealm, deleteRealm,
  generateId, generateRealmId,
  migrateFromLocalStorage, seedDefaultRealm,
} from '../data/storage';

export function useGameData(user, authLoading) {
  const [games,      setGames]      = useState([]);
  const [expansions, setExpansions] = useState([]);
  const [realms,     setRealms]     = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (authLoading) return; // wait for auth to resolve before fetching

    async function init() {
      setLoading(true);
      if (user) await migrateFromLocalStorage(user.id);
      if (user) await seedDefaultRealm(user.id);
      const [g, e, r] = await Promise.all([getGames(), getExpansions(user?.id), getRealms(user?.id)]);
      setGames(g);
      setExpansions(e);
      setRealms(r);
      setLoading(false);
    }
    init();
  }, [user, authLoading]);

  const addGame = useCallback(async (gameData) => {
    const id      = generateId();
    const newGame = { ...gameData, id };
    await insertGame(newGame);
    setGames(prev => [newGame, ...prev]);
    return id;
  }, []);

  const deleteGame = useCallback(async (id) => {
    await removeGame(id);
    setGames(prev => prev.filter(g => g.id !== id));
  }, []);

  const toggleExpansion = useCallback((name) => {
    setExpansions(prev => {
      const u   = prev.map(e => e.name === name ? { ...e, owned: !e.owned } : e);
      const exp = u.find(e => e.name === name);
      if (exp) upsertExpansion(exp.name, exp.type, exp.owned, user?.id);
      return u;
    });
  }, [user]);

  const addRealm = useCallback(async (data) => {
    const realm = {
      ...data,
      id:        generateRealmId(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    await saveRealm(realm, user?.id);
    setRealms(prev => [...prev, realm]);
    return realm;
  }, [user]);

  const updateRealm = useCallback((id, patch) => {
    setRealms(prev => {
      const u       = prev.map(r => r.id === id ? { ...r, ...patch } : r);
      const updated = u.find(r => r.id === id);
      if (updated) saveRealm(updated, user?.id);
      return u;
    });
  }, [user]);

  const removeRealm = useCallback(async (realmId) => {
    await deleteRealm(realmId);
    setRealms(prev => prev.filter(r => r.id !== realmId));
    setGames(prev => prev.filter(g => g.realmId !== realmId));
  }, []);

  return { games, expansions, realms, loading, addGame, deleteGame, toggleExpansion, addRealm, updateRealm, removeRealm };
}
