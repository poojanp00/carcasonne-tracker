import { useState, useCallback } from 'react';
import {
  getGames, saveGames, getExpansions, saveExpansions, generateId,
  getRealms, saveRealms, generateRealmId,
} from '../data/storage';

export function useGameData() {
  const [games,      setGames]      = useState(() => getGames());
  const [expansions, setExpansions] = useState(() => getExpansions());
  const [realms,     setRealms]     = useState(() => getRealms());

  const addGame = useCallback((gameData) => {
    const id      = generateId();
    const newGame = { ...gameData, id };
    setGames(prev => { const u = [newGame, ...prev]; saveGames(u); return u; });
    return id;
  }, []);

  const deleteGame = useCallback((id) => {
    setGames(prev => { const u = prev.filter(g => g.id !== id); saveGames(u); return u; });
  }, []);

  const toggleExpansion = useCallback((name) => {
    setExpansions(prev => {
      const u = prev.map(e => e.name === name ? { ...e, owned: !e.owned } : e);
      saveExpansions(u);
      return u;
    });
  }, []);

  const addRealm = useCallback((data) => {
    const realm = {
      ...data,
      id:        generateRealmId(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setRealms(prev => { const u = [...prev, realm]; saveRealms(u); return u; });
    return realm;
  }, []);

  const updateRealm = useCallback((id, patch) => {
    setRealms(prev => {
      const u = prev.map(r => r.id === id ? { ...r, ...patch } : r);
      saveRealms(u);
      return u;
    });
  }, []);

  return { games, expansions, realms, addGame, deleteGame, toggleExpansion, addRealm, updateRealm };
}
