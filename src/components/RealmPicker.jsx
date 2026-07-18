import { useState } from 'react';
import { MAX_REALMS } from '../constants';

export default function RealmPicker({ realms, currentRealm = null, onSelect, onCreate, initialMode = null, isGuest = false }) {
  const [realmName,   setRealmName]   = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState(['', '']);
  const [nameError,   setNameError]   = useState('');

  const syncCount = (n) => {
    const clamped = Math.max(2, Math.min(6, n));
    setPlayerCount(clamped);
    setPlayerNames(prev => {
      const updated = [...prev];
      while (updated.length < clamped) updated.push('');
      return updated.slice(0, clamped);
    });
  };

  const handleCreate = (e) => {
    e.preventDefault();
    // Shared groups don't count toward the cap — only groups the user owns.
    if (!isGuest && realms.filter(r => r.isOwner !== false).length >= MAX_REALMS) {
      setNameError(`Realm limit reached. Delete an existing realm to create a new one.`);
      return;
    }
    const names = playerNames.map((name, i) => name.trim() || `Player ${i + 1}`);
    const finalRealmName = isGuest ? 'Guest' : realmName.trim();
    if (!isGuest && !finalRealmName) return;
    if (names.length === 0) return;
    const lower = names.map(n => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      setNameError('Player names must be unique.');
      return;
    }
    if (!isGuest && realms.some(r => r.name.toLowerCase() === finalRealmName.toLowerCase())) {
      setNameError('A realm with this name already exists.');
      return;
    }
    setNameError('');
    onCreate({ name: finalRealmName, players: names });
    setRealmName('');
    setPlayerNames(['', '']);
    setPlayerCount(2);
  };

  return null;
}
