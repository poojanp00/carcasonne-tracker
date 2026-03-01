import { useState, useCallback, useEffect } from 'react';
import {
  getGames, insertGame, removeGame,
  getExpansions, upsertExpansion,
  getRealms, saveRealm,
  generateId, generateRealmId,
  migrateFromLocalStorage,
} from '../data/storage';

export function useGameData() {
  const [games,      setGames]      = useState([]);
  const [expansions, setExpansions] = useState([]);
  const [realms,     setRealms]     = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    async function init() {
      await migrateFromLocalStorage();
      const [g, e, r] = await Promise.all([getGames(), getExpansions(), getRealms()]);
      setGames(g);
      setExpansions(e);
      setRealms(r);
      setLoading(false);
    }
    init();
  }, []);

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
      if (exp) upsertExpansion(exp.name, exp.type, exp.owned);
      return u;
    });
  }, []);

  const addRealm = useCallback(async (data) => {
    const realm = {
      ...data,
      id:        generateRealmId(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    await saveRealm(realm);
    setRealms(prev => [...prev, realm]);
    return realm;
  }, []);

  const updateRealm = useCallback((id, patch) => {
    setRealms(prev => {
      const u       = prev.map(r => r.id === id ? { ...r, ...patch } : r);
      const updated = u.find(r => r.id === id);
      if (updated) saveRealm(updated);
      return u;
    });
  }, []);

  return { games, expansions, realms, loading, addGame, deleteGame, toggleExpansion, addRealm, updateRealm };
}
