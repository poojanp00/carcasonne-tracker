import { useState, useCallback } from 'react';
import { getGames, saveGames, getExpansions, saveExpansions, generateId } from '../data/storage';

export function useGameData() {
  const [games, setGames]           = useState(() => getGames());
  const [expansions, setExpansions] = useState(() => getExpansions());

  const addGame = useCallback((gameData) => {
    const newGame = { ...gameData, id: generateId() };
    setGames(prev => {
      const updated = [newGame, ...prev];
      saveGames(updated);
      return updated;
    });
  }, []);

  const deleteGame = useCallback((id) => {
    setGames(prev => {
      const updated = prev.filter(g => g.id !== id);
      saveGames(updated);
      return updated;
    });
  }, []);

  const toggleExpansion = useCallback((name) => {
    setExpansions(prev => {
      const updated = prev.map(e => e.name === name ? { ...e, owned: !e.owned } : e);
      saveExpansions(updated);
      return updated;
    });
  }, []);

  return { games, expansions, addGame, deleteGame, toggleExpansion };
}
