import { useState } from 'react';
import { DEFAULT_EXPANSIONS } from '../data/expansions';

const COMPLETE_SET = new Set(DEFAULT_EXPANSIONS.filter(e => e.complete).map(e => e.name));

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

// ── Full expansion icons ──────────────────────────────────────────
import iconInnsCathedrals        from '../../images/icons/full-expansion-icons/Symbol_InnsCathedrals_C1C2.png';
import iconTradersBuilders        from '../../images/icons/full-expansion-icons/Symbol_TradersBuilders_C2.png';
import iconPrincessDragon         from '../../images/icons/full-expansion-icons/Symbol_PrincessDragon_C1C2.png';
import iconTower                  from '../../images/icons/full-expansion-icons/Symbol_Tower_C1C2.png';
import iconAbbeyMayor             from '../../images/icons/full-expansion-icons/Symbol_AbbeyMayor_C1C2.png';
import iconCountKingRobber        from '../../images/icons/full-expansion-icons/Symbol_CountKingRobber_C1C2.png';
import iconCatapult               from '../../images/icons/full-expansion-icons/Symbol_Catapult_C1.png';
import iconBridgesCastlesBazaars  from '../../images/icons/full-expansion-icons/Symbol_BridgesCastlesBazaars_C1C2.png';
import iconHillsSheep             from '../../images/icons/full-expansion-icons/Symbol_HillsSheep_C1C2.png';
import iconUnderBigTop            from '../../images/icons/full-expansion-icons/Symbol_UnderTheBigTop_C2.png';

// ── Mini expansion icons ──────────────────────────────────────────
import iconAbbot          from '../../images/icons/mini-expansion-icons/Symbol_Abbot_C2.png';
import iconRiverII        from '../../images/icons/mini-expansion-icons/Symbol_RiverIII_C1C2.png';
import iconFlyingMachines from '../../images/icons/mini-expansion-icons/Symbol_Flier_C1C2.png';
import iconFerries        from '../../images/icons/mini-expansion-icons/Symbol_Ferries_C1C2.png';
import iconGoldMines      from '../../images/icons/mini-expansion-icons/Symbol_GoldMines_C1C2.png';
import iconMageWitch      from '../../images/icons/mini-expansion-icons/Symbol_MageWitch_C1C2.png';
import iconRobbers        from '../../images/icons/mini-expansion-icons/Symbol_Robbers_C1C2.png';
import iconCropCircles    from '../../images/icons/mini-expansion-icons/Symbol_CropCircles_C1C2.png';

const EXPANSION_ICONS = {
  'Inns & Cathedrals':           iconInnsCathedrals,
  'Traders & Builders':          iconTradersBuilders,
  'The Princess & the Dragon':   iconPrincessDragon,
  'The Tower':                   iconTower,
  'Abbey & Mayor':               iconAbbeyMayor,
  'Count, King & Robber':        iconCountKingRobber,
  'The Catapult':                iconCatapult,
  'Bridges, Castles & Bazaars':  iconBridgesCastlesBazaars,
  'Hills & Sheep':               iconHillsSheep,
  'Under the Big Top':           iconUnderBigTop,
  'The Abbot':                   iconAbbot,
  'The River':                   iconRiverII,
  'The River II':                iconRiverII,
  'The Flying Machines':         iconFlyingMachines,
  'The Ferries':                 iconFerries,
  'The Gold Mines':              iconGoldMines,
  'Mage & Witch':                iconMageWitch,
  'Robbers':                     iconRobbers,
  'Crop Circles':                iconCropCircles,
};

function ExpansionGroup({ label, expansions, onToggle, canEdit, completeSet }) {
  const [open, setOpen] = useState(true);
  const owned   = expansions.filter((e) => e.owned);
  const unowned = expansions.filter((e) => !e.owned);

  return (
    <div className="tile-card" style={{ marginBottom: '1.2rem' }}>
      <div
        className="collapsible-toggle tile-card-header"
        onClick={() => setOpen((o) => !o)}
        style={{ borderBottom: open ? '1px solid var(--warm-gold)' : 'none', paddingBottom: open ? '0.5rem' : 0, cursor: 'pointer' }}
      >
        <span>{label} <span style={{ fontFamily: 'Crimson Text, serif', fontWeight: 400, fontSize: 'clamp(0.7rem, 2vw, 0.85rem)', opacity: 0.7 }}>({owned.length}/{expansions.length})</span></span>
        <span className={`collapsible-arrow ${open ? 'open' : ''}`} />
      </div>

      {open && (
        <div style={{ marginTop: '1rem' }}>
          {owned.length > 0 && (
            <>
              <div className="collection-group-label owned-label">In Your Possession</div>
              <div className="collection-grid" style={{ marginBottom: unowned.length > 0 ? '1.5rem' : 0 }}>
                {owned.map((exp) => {
                  const isComplete = completeSet?.has(exp.name) ?? true;
                  return (
                    <div
                      key={exp.name}
                      className={`expansion-item owned${canEdit && isComplete ? '' : ' read-only'}${!isComplete ? ' dev-tooltip' : ''}`}
                      onClick={canEdit && isComplete ? () => onToggle(exp.name) : undefined}
                      data-tooltip={!isComplete ? 'Under development. Please check back later.' : undefined}
                    >
                      <div className="status-dot" />
                      {EXPANSION_ICONS[exp.name] && (
                        <img src={EXPANSION_ICONS[exp.name]} alt="" className="expansion-icon" />
                      )}
                      <span>{exp.name}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {unowned.length > 0 && (
            <>
              <div className="collection-group-label unowned-label">Not Yet Acquired</div>
              <div className="collection-grid">
                {unowned.map((exp) => {
                  const isComplete = completeSet?.has(exp.name) ?? true;
                  return (
                    <div
                      key={exp.name}
                      className={`expansion-item unowned${canEdit && isComplete ? '' : ' read-only'}${!isComplete ? ' dev-tooltip' : ''}`}
                      onClick={canEdit && isComplete ? () => onToggle(exp.name) : undefined}
                      data-tooltip={!isComplete ? 'Under development. Please check back later.' : undefined}
                    >
                      <div className="status-dot" />
                      {EXPANSION_ICONS[exp.name] && (
                        <img src={EXPANSION_ICONS[exp.name]} alt="" className="expansion-icon" />
                      )}
                      <span>{exp.name}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Collection({ expansions, onToggle, userId, isGuest = false, onDeleteAccount }) {
  const canEdit = !isGuest;
  const owned = expansions.filter((e) => e.owned);
  const full  = expansions.filter((e) => e.type === 'full');
  const mini  = expansions.filter((e) => e.type === 'mini');

  const [deleteStep,   setDeleteStep]   = useState(0); // 0=hidden, 1=first confirm, 2=final confirm
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await onDeleteAccount?.();
    } catch (err) {
      setDeleteError(err.message || 'Something went wrong. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="section-title">
        <h2>My Collection</h2>
        <div className="section-title-line" />
        <span className="game-count">{owned.length} / {expansions.length}</span>
      </div>

      <ExpansionGroup label="Full Expansions" expansions={full} onToggle={onToggle} canEdit={canEdit} completeSet={COMPLETE_SET} />
      <ExpansionGroup label="Mini Expansions" expansions={mini} onToggle={onToggle} canEdit={canEdit} completeSet={COMPLETE_SET} />

      {!isGuest && (
        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center' }}>
          <button
            className="realm-trash-btn"
            onClick={() => { setDeleteStep(1); setDeleteError(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--stone-gray)', fontSize: 'clamp(0.68rem, 2vw, 0.82rem)', fontFamily: 'Cinzel, serif', letterSpacing: '0.06em' }}
          >
            <TrashIcon /> Delete Account
          </button>
        </div>
      )}

      {/* Step 1 confirmation */}
      {deleteStep === 1 && (
        <div className="realm-modal-overlay" onClick={() => setDeleteStep(0)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Delete Account?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              This will delete your account and all associated groups, games, and player data.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteStep(0)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => setDeleteStep(2)}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 final confirmation */}
      {deleteStep === 2 && (
        <div className="realm-modal-overlay" onClick={() => !deleting && setDeleteStep(0)}>
          <div className="realm-modal tile-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--deep-red)', marginBottom: '0.5rem' }}>Are you sure?</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 }}>
              Your data will be permanently deleted.
            </p>
            {deleteError && (
              <p style={{ color: 'var(--deep-red)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteStep(0)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
