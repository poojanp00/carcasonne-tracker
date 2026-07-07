# Toggling the "Party Mode" gate in Pre-Game Setup

Party Mode is a fully implemented feature, but its card in the mode-selection
screen (`src/components/PreGameSetup.jsx`, Step 2) can be toggled between a
**disabled "under development" state** (for public/guest users) and an
**enabled, selectable state** (for local testing).

Ask Claude: *"enable party mode in PreGameSetup"* or *"disable party mode in
PreGameSetup"* and reference this file.

## File
`src/components/PreGameSetup.jsx`

## ENABLED (selectable, for testing)

State declarations (~line 60-62):
```jsx
const [mode, setMode] = useState('table'); // 'table' | 'party'
const [modeInfoOpen, setModeInfoOpen] = useState(new Set());
const [modeInfoHover, setModeInfoHover] = useState(null);
```
(no `partyGuestHover` state)

Party Mode card (Step 2, after the Table Mode `<button>`):
```jsx
<button
  type="button"
  className={`mode-card${mode === 'party' ? ' selected' : ''}`}
  onClick={() => setMode('party')}
>
  <div className="mode-card-icon"><img src={partyModeImg} alt="Party Mode" /></div>
  <div className="mode-card-title">
    Party Mode
    <span
      className="mode-card-info-icon"
      onClick={e => { e.stopPropagation(); setModeInfoOpen(prev => { const s = new Set(prev); s.has('party') ? s.delete('party') : s.add('party'); return s; }); }}
      onMouseEnter={() => setModeInfoHover('party')}
      onMouseLeave={() => setModeInfoHover(null)}
    >ⓘ</span>
  </div>
  {(modeInfoOpen.has('party') || modeInfoHover === 'party') && (
    <div className="mode-card-desc">
      Each player joins on their own device to submit scores; the host manages the shared board.
    </div>
  )}
</button>
```

## DISABLED (grayed out, "under development" tooltip)

Add back the extra state (~line 62, after `modeInfoHover`):
```jsx
const [partyGuestHover, setPartyGuestHover] = useState(false);
```

Replace the Party Mode `<button>` above with:
```jsx
<div
  style={{ position: 'relative', width: '100%' }}
  onMouseEnter={() => setPartyGuestHover(true)}
  onMouseLeave={() => setPartyGuestHover(false)}
>
  <button
    type="button"
    className="mode-card"
    disabled
    style={{ opacity: 0.45, width: '100%' }}
  >
    <div className="mode-card-icon"><img src={partyModeImg} alt="Party Mode" /></div>
    <div className="mode-card-title">Party Mode</div>
  </button>
  {partyGuestHover && (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'var(--earth-brown)', color: 'var(--parchment)',
      padding: '0.4rem 0.7rem', borderRadius: '8px',
      zIndex: 9999, pointerEvents: 'none',
      maxWidth: 'min(200px, 85%)', textAlign: 'center',
      boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
      fontFamily: 'Crimson Text, serif', fontSize: '0.85rem', fontStyle: 'italic',
      lineHeight: 1.4,
    }}>
      Under development. <br /> Please check back later!
    </div>
  )}
</div>
```

## Notes
- `mode-card-info-icon` / `mode-card-desc` styling and the `modeInfoOpen`/
  `modeInfoHover` state are shared with the Table Mode card — don't remove
  those when disabling Party Mode, only revert the Party Mode card itself.
- This only gates the **UI selector**; it doesn't touch any Party Mode
  logic in `Board.jsx`, `Play.jsx`, `Lobby.jsx`, or `partySession.js`.
