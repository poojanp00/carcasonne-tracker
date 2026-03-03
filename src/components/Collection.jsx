import { useState } from 'react';

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

function ExpansionGroup({ label, expansions, onToggle, canEdit }) {
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
        <span>{label} <span style={{ fontFamily: 'Crimson Text, serif', fontWeight: 400, fontSize: '0.85rem', opacity: 0.7 }}>({owned.length}/{expansions.length})</span></span>
        <span className={`collapsible-arrow ${open ? 'open' : ''}`} />
      </div>

      {open && (
        <div style={{ marginTop: '1rem' }}>
          {owned.length > 0 && (
            <>
              <div className="collection-group-label owned-label">In Your Possession</div>
              <div className="collection-grid" style={{ marginBottom: unowned.length > 0 ? '1.5rem' : 0 }}>
                {owned.map((exp) => (
                  <div
                    key={exp.name}
                    className={`expansion-item owned${canEdit ? '' : ' read-only'}`}
                    onClick={canEdit ? () => onToggle(exp.name) : undefined}
                    title={canEdit ? 'Click to mark as not owned' : undefined}
                  >
                    <div className="status-dot" />
                    {EXPANSION_ICONS[exp.name] && (
                      <img src={EXPANSION_ICONS[exp.name]} alt="" className="expansion-icon" />
                    )}
                    <span>{exp.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {unowned.length > 0 && (
            <>
              <div className="collection-group-label unowned-label">Not Yet Acquired</div>
              <div className="collection-grid">
                {unowned.map((exp) => (
                  <div
                    key={exp.name}
                    className={`expansion-item unowned${canEdit ? '' : ' read-only'}`}
                    onClick={canEdit ? () => onToggle(exp.name) : undefined}
                    title={canEdit ? 'Click to mark as owned' : undefined}
                  >
                    <div className="status-dot" />
                    {EXPANSION_ICONS[exp.name] && (
                      <img src={EXPANSION_ICONS[exp.name]} alt="" className="expansion-icon" />
                    )}
                    <span>{exp.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Collection({ expansions, onToggle, userId, isGuest = false }) {
  const canEdit = !isGuest;
  const owned = expansions.filter((e) => e.owned);
  const full  = expansions.filter((e) => e.type === 'full');
  const mini  = expansions.filter((e) => e.type === 'mini');

  return (
    <div>
      <div className="section-title">
        <h2>My Collection</h2>
        <div className="section-title-line" />
        <span className="game-count">{owned.length} / {expansions.length}</span>
      </div>

      <ExpansionGroup label="Full Expansions" expansions={full} onToggle={onToggle} canEdit={canEdit} />
      <ExpansionGroup label="Mini Expansions" expansions={mini} onToggle={onToggle} canEdit={canEdit} />
    </div>
  );
}
