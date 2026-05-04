import React, { useState } from 'react';
import { Plus, Trash2, Cpu, RefreshCw, ChevronUp, ChevronDown, Play, Sword, Zap, User } from 'lucide-react';
import cardManifest from './cardManifest.json';
import mechsDB from './mechsDB.json';
import specialDB from './specialDB.json';

const MECH_TYPES = [
  "None",
  "Ambusher (Infantry)",
  "Brawler",
  "Scout",
  "Scout (Hover)",
  "Skirmisher",
  "Skirmisher (JMPS)",
  "Striker",
  "Striker (Hover)",
  "Juggernaut",
  "Missile boat",
  "Sniper"
];

const MechDisplayName = ({ mech }) => {
  if (!mech) return null;
  const nameToUse = mech.baseName || mech.name;
  if (mech.variantIndex > 0) {
    const letter = String.fromCharCode(64 + mech.variantIndex);
    return (
      <>{nameToUse} <span className="mech-variant-letter">[{letter}]</span></>
    );
  }
  return <>{nameToUse}</>;
};

function App() {
  const [mechs, setMechs] = useState([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(MECH_TYPES[0]);
  const [newOV, setNewOV] = useState(0);
  const [newMove, setNewMove] = useState('');
  const [newTMM, setNewTMM] = useState(0);
  const [newDmg, setNewDmg] = useState({ S: '0', M: '0', L: '0' });
  const [newAbilities, setNewAbilities] = useState('');
  const [currentPhase, setCurrentPhase] = useState('mantenimiento'); // mantenimiento, iniciativa, movimiento, combate
  const [activeMechIndex, setActiveMechIndex] = useState(0);
  const [selectedCommander, setSelectedCommander] = useState("Mechwarrior Clan Jade Falcon");
  const [commanderCard, setCommanderCard] = useState("A");
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [selectedAbility, setSelectedAbility] = useState(null);

  const calculateSingleTMM = (moveStr) => {
    if (!moveStr) return 0;
    const cleanStr = moveStr.toString().toLowerCase();
    if (cleanStr.includes('a')) return 0;
    const num = parseInt(cleanStr) || 0;
    if (num >= 36) return 5;
    if (num >= 20 && num <= 35) return 4;
    if (num >= 14 && num <= 19) return 3;
    if (num >= 10 && num <= 13) return 2;
    if (num >= 6 && num <= 9) return 1;
    return 0;
  };

  const calculateTMM = (moveValue) => {
    if (!moveValue) return 0;
    const moveStr = moveValue.toString();
    if (moveStr.includes('/')) {
      const parts = moveStr.split('/');
      const tmmParts = parts.map(p => calculateSingleTMM(p));
      if (tmmParts[0] === tmmParts[1]) return tmmParts[0];
      return tmmParts.join('/');
    }
    return calculateSingleTMM(moveStr);
  };

  const calculateAdjustedMove = (moveStr, heat) => {
    if (!moveStr) return moveStr;
    const heatLevel = parseInt(heat) || 0;
    if (heatLevel === 0) return moveStr;

    const penalty = heatLevel * 2;
    const parts = moveStr.toString().split('/');
    const adjustedParts = parts.map(part => {
      const match = part.match(/^(\d+)(.*)$/);
      if (!match) return part;
      const num = parseInt(match[1]);
      const suffix = match[2];
      if (suffix.toLowerCase().includes('j')) {
        return part; // No penalty for jump
      }
      const newVal = Math.max(0, num - penalty);
      return `${newVal}${suffix}`;
    });
    return adjustedParts.join('/');
  };

  const handleMoveChange = (val) => {
    setNewMove(val);
    setNewTMM(calculateTMM(val));
  };

  const addMech = (e) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;

    let updatedMechs = [...mechs];
    const existing = updatedMechs.filter(m => (m.baseName || m.name) === cleanName);

    let variantIndex = 0;
    if (existing.length > 0) {
      const maxVariant = Math.max(...existing.map(m => m.variantIndex || 0), 0);
      if (maxVariant === 0) {
        const firstIndex = updatedMechs.findIndex(m => (m.baseName || m.name) === cleanName);
        if (firstIndex !== -1) {
          updatedMechs[firstIndex] = { ...updatedMechs[firstIndex], variantIndex: 1, baseName: cleanName };
        }
        variantIndex = 2;
      } else {
        variantIndex = maxVariant + 1;
      }
    }

    updatedMechs.push({
      id: Date.now(),
      name: cleanName,
      baseName: cleanName,
      variantIndex,
      type: newType,
      ov: parseInt(newOV) || 0,
      heat: 0,
      move: newMove,
      tmm: parseInt(newTMM) || 0,
      damage: { ...newDmg },
      abilities: newAbilities,
      currentCard: null
    });
    setMechs(updatedMechs);
    setNewName('');
    setNewOV(0);
    setNewMove('');
    setNewTMM(0);
    setNewDmg({ S: '0', M: '0', L: '0' });
    setNewAbilities('');
  };

  const removeMech = (id) => {
    setMechs(mechs.filter(m => m.id !== id));
  };

  const adjustHeat = (id, delta) => {
    setMechs(mechs.map(m => {
      if (m.id === id) {
        let newHeat = (m.heat || 0) + delta;
        if (newHeat < 0) newHeat = 0;
        if (newHeat > 4) newHeat = 4;
        return { ...m, heat: newHeat };
      }
      return m;
    }));
  };

  const updateMech = (id, field, value) => {
    setMechs(mechs.map(m => {
      if (m.id === id) {
        const updated = { ...m, [field]: value };
        if (field === 'move') {
          updated.tmm = calculateTMM(value);
        }
        return updated;
      }
      return m;
    }));
  };

  const updateMechDmg = (id, range, value) => {
    setMechs(mechs.map(m => {
      if (m.id === id) {
        return {
          ...m,
          damage: { ...m.damage, [range]: value }
        };
      }
      return m;
    }));
  };

  const generateAllCards = (currentMechs) => {
    return currentMechs.map(m => {
      const typeImages = cardManifest[m.type] || [];
      if (typeImages.length === 0) return { ...m, currentCard: null, movInit: 0, comInit: 0 };

      let randomFile;
      const lastFileMatch = m.currentCard?.match(/\/([^/]+)$/);
      const lastFile = lastFileMatch ? lastFileMatch[1] : null;

      do {
        randomFile = typeImages[Math.floor(Math.random() * typeImages.length)];
      } while (randomFile === lastFile && typeImages.length > 1);

      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const cardPath = `${base}/assets/${m.type}/${randomFile}`;

      const match = randomFile.match(/(\d{3})\s+(\d{3})/);
      let movInit = 0;
      let comInit = 0;
      if (match) {
        movInit = parseInt(match[1]);
        comInit = parseInt(match[2]);
      }
      return { ...m, currentCard: cardPath, movInit, comInit };
    });
  };

  const startIniciativa = () => {
    const updatedMechs = generateAllCards(mechs);
    const sorted = [...updatedMechs].sort((a, b) => (a.movInit || 0) - (b.movInit || 0));
    setMechs(sorted);
    setCurrentPhase('iniciativa');
  };

  const startMovimiento = () => {
    setCurrentPhase('movimiento');
    setActiveMechIndex(0);
  };

  const nextMech = () => {
    if (activeMechIndex < visibleMechs.length - 1) {
      setActiveMechIndex(activeMechIndex + 1);
    }
  };

  const startCombate = () => {
    const sorted = [...mechs].sort((a, b) => {
      if (a.type === 'None' && b.type !== 'None') return -1;
      if (a.type !== 'None' && b.type === 'None') return 1;
      return (a.comInit || 0) - (b.comInit || 0);
    });
    setMechs(sorted);
    setCurrentPhase('combate');
    setActiveMechIndex(0);
  };

  const prevMech = () => {
    if (activeMechIndex > 0) {
      setActiveMechIndex(activeMechIndex - 1);
    }
  };

  const moveMech = (index, direction) => {
    const newMechs = [...mechs];
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < newMechs.length) {
      [newMechs[index], newMechs[targetIndex]] = [newMechs[targetIndex], newMechs[index]];
      setMechs(newMechs);
    }
  };

  const moveToFirst = (index) => {
    if (index === 0) return;
    const newMechs = [...mechs];
    const item = newMechs.splice(index, 1)[0];
    newMechs.unshift(item);
    setMechs(newMechs);
  };

  const moveToLast = (index) => {
    if (index === mechs.length - 1) return;
    const newMechs = [...mechs];
    const item = newMechs.splice(index, 1)[0];
    newMechs.push(item);
    setMechs(newMechs);
  };

  const onDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
  };

  const onDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newMechs = [...mechs];
    const item = newMechs.splice(draggedIndex, 1)[0];
    newMechs.splice(index, 0, item);

    setMechs(newMechs);
    setDraggedIndex(null);
  };

  const findAbilityRule = (mechAbility) => {
    if (!mechAbility) return null;
    const ability = mechAbility.trim();

    // 1. Exact match
    let found = specialDB.find(s => s.abbreviation.toLowerCase() === ability.toLowerCase());
    if (found) return found;

    // 2. Prefix match
    const match = ability.match(/^([A-Za-z\-]+)/);
    if (match) {
      const prefix = match[1].toLowerCase();
      const candidates = specialDB.filter(s => s.abbreviation.toLowerCase().startsWith(prefix));

      for (let c of candidates) {
        let patternStr = c.abbreviation
          .replace(/[.#*+?^${}()|[\]\\]/g, '\\$&') // escape special characters
          .replace(/X/g, '(\\d+|-)')
          .replace(/\\#/g, '\\d+');
        const regex = new RegExp('^' + patternStr + '$', 'i');
        if (regex.test(ability)) return c;
      }
      if (candidates.length > 0) return candidates[0];
    }
    return null;
  };

  const showAbilityInfo = (abilityName) => {
    const rule = findAbilityRule(abilityName);
    if (rule) {
      setSelectedAbility({ original: abilityName, ...rule });
    } else {
      setSelectedAbility({ original: abilityName, ability: abilityName, summary: "No se encontró regla en la base de datos.", rules: "" });
    }
  };

  const renderAbilities = (mech) => {
    if (!mech.abilities) return null;
    const abilitiesList = mech.abilities.split(',').map(a => a.trim()).filter(a => a);
    if (abilitiesList.length === 0) return null;
    return (
      <div className="mech-abilities-list">
        {abilitiesList.map((ab, i) => (
          <span
            key={i}
            className="ability-tag"
            onClick={(e) => { e.stopPropagation(); showAbilityInfo(ab); }}
            title="Ver regla"
          >
            {ab}
          </span>
        ))}
      </div>
    );
  };

  const visibleMechs = (currentPhase === 'iniciativa' || currentPhase === 'movimiento')
    ? mechs.filter(m => m.type !== 'None')
    : mechs;

  const activeMech = visibleMechs[activeMechIndex];

  return (
    <div className={`app-container phase-${currentPhase}`}>
      <header>
        <div className="header-left">
          <div className="logo" onClick={() => setCurrentPhase('mantenimiento')} style={{ cursor: 'pointer' }}>
            <Cpu size={24} />
            BATTLETECH ACES IA
          </div>

          <div className="phase-controls">
            <button
              className={`phase-btn ${currentPhase === 'mantenimiento' ? 'active' : ''}`}
              onClick={() => setCurrentPhase('mantenimiento')}
            >
              Mantenimiento
            </button>
            <button
              className={`phase-btn ${currentPhase === 'iniciativa' ? 'active' : ''}`}
              onClick={startIniciativa}
            >
              <Zap size={18} /> Iniciativa
            </button>
            <button
              className={`phase-btn ${currentPhase === 'movimiento' ? 'active' : ''}`}
              onClick={startMovimiento}
              disabled={mechs.length === 0}
            >
              <Play size={18} /> Movimiento
            </button>
            <button
              className={`phase-btn ${currentPhase === 'combate' ? 'active' : ''}`}
              onClick={startCombate}
              disabled={mechs.length === 0}
            >
              <Sword size={18} /> Combate
            </button>
          </div>
        </div>

        <div className="header-right">
          {currentPhase === 'mantenimiento' && (
            <>
              <div className="commander-setup">
                <User size={18} />
                <select value={selectedCommander} onChange={(e) => setSelectedCommander(e.target.value)}>
                  <option value="Mechwarrior Clan Jade Falcon">Mechwarrior Clan Jade Falcon</option>
                  <option value="StarCaptain Clan Jade Falcon">StarCaptain Clan Jade Falcon</option>
                </select>
                <select value={commanderCard} onChange={(e) => setCommanderCard(e.target.value)}>
                  {["A", "B", "C", "D", "E"].map(letter => (
                    <option key={letter} value={letter}>Carta {letter}</option>
                  ))}
                </select>
              </div>

              <form className="add-mech-form" onSubmit={addMech}>
                <div className="input-group">
                  <label>Nombre del Mech</label>
                  <datalist id="mech-suggestions">
                    {mechsDB.map((m, i) => (
                      <option key={i} value={m.name} />
                    ))}
                  </datalist>
                  <input
                    type="text"
                    list="mech-suggestions"
                    placeholder="Buscar mech..."
                    value={newName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewName(val);
                      const found = mechsDB.find(m => m.name === val);
                      if (found) {
                        setNewOV(found.overheat || 0);
                        handleMoveChange(found.move || '');
                        setNewDmg(found.damage || { S: '0', M: '0', L: '0' });
                        setNewAbilities(found.abilities || '');
                        const roleLower = (found.role || '').toLowerCase();
                        const moveLower = (found.move || '').toLowerCase();

                        let targetRole = roleLower;
                        if ((roleLower === 'scout' || roleLower === 'striker') && moveLower.includes('h')) {
                          targetRole = `${roleLower} (hover)`;
                        } else if (roleLower === 'skirmisher' && moveLower.includes('j')) {
                          targetRole = 'skirmisher (jmps)';
                        }

                        const matchType = MECH_TYPES.find(t => t.toLowerCase() === targetRole) || MECH_TYPES.find(t => t.toLowerCase().startsWith(targetRole));
                        if (matchType) {
                          setNewType(matchType);
                        }
                      }
                    }}
                  />
                </div>

                <div className="input-group">
                  <label>Tipo</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)}>
                    {MECH_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label>OV</label>
                  <input
                    type="number"
                    placeholder="OV"
                    min="0"
                    max="4"
                    value={newOV}
                    onChange={(e) => setNewOV(e.target.value)}
                    style={{ width: '60px' }}
                    title="Overheating (OV) 0-4"
                  />
                </div>

                <div className="input-group">
                  <label>Move</label>
                  <input
                    type="text"
                    placeholder="Move"
                    value={newMove}
                    onChange={(e) => handleMoveChange(e.target.value)}
                    style={{ width: '60px' }}
                    title="Movimiento"
                  />
                </div>

                <div className="input-group">
                  <label>TMM</label>
                  <input
                    type="number"
                    placeholder="TMM"
                    min="0"
                    max="5"
                    value={newTMM}
                    onChange={(e) => setNewTMM(e.target.value)}
                    style={{ width: '60px' }}
                    title="TMM"
                  />
                </div>

                <div className="input-group-row">
                  <div className="input-group">
                    <label style={{ textAlign: 'center' }}>S</label>
                    <input type="text" value={newDmg.S} onChange={(e) => setNewDmg({ ...newDmg, S: e.target.value })} style={{ width: '45px', textAlign: 'center' }} title="Damage Corto" />
                  </div>
                  <div className="input-group">
                    <label style={{ textAlign: 'center' }}>M</label>
                    <input type="text" value={newDmg.M} onChange={(e) => setNewDmg({ ...newDmg, M: e.target.value })} style={{ width: '45px', textAlign: 'center' }} title="Damage Medio" />
                  </div>
                  <div className="input-group">
                    <label style={{ textAlign: 'center' }}>L</label>
                    <input type="text" value={newDmg.L} onChange={(e) => setNewDmg({ ...newDmg, L: e.target.value })} style={{ width: '45px', textAlign: 'center' }} title="Damage Largo" />
                  </div>
                </div>

                <button type="submit">
                  <Plus size={18} />
                  Añadir
                </button>
              </form>
            </>)}
        </div>
      </header>

      <main>
        {currentPhase === 'mantenimiento' && visibleMechs.length === 0 ? (
          <div className="empty-state">
            <p>No hay mechs añadidos. ¡Crea uno para empezar!</p>
          </div>
        ) : (
          <div className="content-area">
            {currentPhase === 'movimiento' || currentPhase === 'combate' ? (
              <div className="movement-phase">
                <div className="movement-sidebar">
                  {visibleMechs.map((m, i) => (
                    <div
                      key={m.id}
                      className={`sidebar-item ${i === activeMechIndex ? 'active' : ''} ${i < activeMechIndex ? 'completed' : ''}`}
                    >
                      <div className="sidebar-info">
                        <span className="sidebar-name"><MechDisplayName mech={m} /></span>
                      </div>
                      <div className={`card-display-sidebar ${currentPhase}`}>
                        {m.currentCard && <img src={m.currentCard} alt="Mech Header" />}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="movement-main">
                  <div className="active-mech-display">
                    {activeMech ? (
                      <>
                        <div className="mech-header">
                          <h2><MechDisplayName mech={activeMech} /></h2>
                          <span className="mech-type">{activeMech.type}</span>
                          <div className="principal-stats">
                            <span className="stat-badge">OV: {activeMech.ov || 0}</span>
                            <span className={`stat-badge ${activeMech.heat > 0 && activeMech.move !== calculateAdjustedMove(activeMech.move, activeMech.heat) ? 'stat-modified' : ''}`}>
                              Move: {calculateAdjustedMove(activeMech.move, activeMech.heat) || '-'}
                              {activeMech.heat > 0 && activeMech.move !== calculateAdjustedMove(activeMech.move, activeMech.heat) && (
                                <span className="base-stat-hint"> ({activeMech.move})</span>
                              )}
                            </span>
                            <span className={`stat-badge ${activeMech.heat > 0 && activeMech.tmm !== calculateTMM(calculateAdjustedMove(activeMech.move, activeMech.heat)) ? 'stat-modified' : ''}`}>
                              TMM: {calculateTMM(calculateAdjustedMove(activeMech.move, activeMech.heat)) ?? '-'}
                              {activeMech.heat > 0 && activeMech.tmm !== calculateTMM(calculateAdjustedMove(activeMech.move, activeMech.heat)) && (
                                <span className="base-stat-hint"> ({activeMech.tmm})</span>
                              )}
                            </span>
                            <span className="stat-badge" title="Damage: Corto / Medio / Largo">DMG: {activeMech.damage?.S || '0'} / {activeMech.damage?.M || '0'} / {activeMech.damage?.L || '0'}</span>
                            <div className="heat-control-container">
                              <span className={`stat-badge ${activeMech.heat > 0 ? 'stat-modified' : ''}`}>Heat: {activeMech.heat || 0}/4</span>
                              {currentPhase === 'combate' && (
                                <div className="heat-controls-mini">
                                  <button onClick={() => adjustHeat(activeMech.id, -1)} disabled={(activeMech.heat || 0) <= 0}>-</button>
                                  <button onClick={() => adjustHeat(activeMech.id, 1)} disabled={(activeMech.heat || 0) >= 4}>+</button>
                                </div>
                              )}
                            </div>
                          </div>
                          {renderAbilities(activeMech)}
                        </div>
                        <div className={`card-display-principal ${currentPhase} ${activeMech.type === 'None' ? 'role-none' : ''}`}>
                          {activeMech.type === 'None' && currentPhase === 'combate' ? (
                            <img
                              src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/assets/Commander/${selectedCommander}/${selectedCommander} ${commanderCard}.png`}
                              alt="Commander Card"
                              className="none-role-combat-card"
                            />
                          ) : activeMech.currentCard && (
                            <img src={activeMech.currentCard} alt="Mech Card" />
                          )}
                        </div>
                        <div className="movement-nav">
                          <button className="secondary-btn" onClick={prevMech} disabled={activeMechIndex === 0}>
                            Anterior
                          </button>
                          <div className="mech-counter">
                            {activeMechIndex + 1} / {visibleMechs.length}
                          </div>
                          {activeMechIndex === visibleMechs.length - 1 ? (
                            <button
                              className="primary-btn phase-transition"
                              onClick={() => {
                                if (currentPhase === 'movimiento') startCombate();
                                else setCurrentPhase('mantenimiento');
                              }}
                            >
                              {currentPhase === 'movimiento' ? (
                                <><Sword size={18} /> Combate</>
                              ) : (
                                <><RefreshCw size={18} /> Finalizar Turno</>
                              )}
                            </button>
                          ) : (
                            <button className="primary-btn" onClick={nextMech}>
                              Siguiente mech
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="no-mech-selected">No hay mechs para esta fase</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`mechs-grid ${currentPhase}`}>
                {visibleMechs.map((mech, index) => (
                  <div
                    key={mech.id}
                    className={`mech-card-view ${currentPhase}`}
                    draggable={currentPhase === 'iniciativa'}
                    onDragStart={(e) => onDragStart(e, index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    onDrop={(e) => onDrop(e, index)}
                  >
                    <div className="mech-header">
                      {currentPhase === 'iniciativa' && (
                        <div className="reorder-btns">
                          <button onClick={() => moveMech(index, -1)} disabled={index === 0}>
                            <ChevronUp size={16} />
                          </button>
                          <button onClick={() => moveMech(index, 1)} disabled={index === mechs.length - 1}>
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      )}
                      <div className={`card-display-${currentPhase}`}>
                        {currentPhase === 'mantenimiento' ? (
                          <img
                            src={mechsDB.find(m => m.name === mech.name)?.imagelink || 'https://via.placeholder.com/250x350?text=No+Image'}
                            alt="Mech Image"
                            className="card-image"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                          />
                        ) : mech.currentCard ? (
                          <img
                            src={mech.currentCard}
                            alt="Mech Card"
                            className="card-image"
                          />
                        ) : (
                          <div className="no-card">Sin carta</div>
                        )}
                      </div>

                      <div className="mech-info">
                        <h2><MechDisplayName mech={mech} /></h2>
                        {currentPhase === 'mantenimiento' && (
                          <>
                            <span className="mech-type">{mech.type}</span>
                            <div className="grid-stats">
                              <span className="stat-badge">OV: {mech.ov || 0}</span>
                              <div className="inline-edit-group">
                                <label>Move</label>
                                <input type="text" value={mech.move || ''} onChange={(e) => updateMech(mech.id, 'move', e.target.value)} style={{ width: '50px' }} />
                                {mech.heat > 0 && mech.move !== calculateAdjustedMove(mech.move, mech.heat) && (
                                  <span className="base-stat-hint stat-modified" title="Adjusted Move" style={{ padding: '2px 4px', borderRadius: '4px' }}>{calculateAdjustedMove(mech.move, mech.heat)}</span>
                                )}
                              </div>
                              <div className="inline-edit-group">
                                <label>TMM</label>
                                <input type="number" value={mech.tmm || 0} onChange={(e) => updateMech(mech.id, 'tmm', parseInt(e.target.value) || 0)} style={{ width: '50px' }} />
                                {mech.heat > 0 && mech.tmm !== calculateTMM(calculateAdjustedMove(mech.move, mech.heat)) && (
                                  <span className="base-stat-hint stat-modified" title="Adjusted TMM" style={{ padding: '2px 4px', borderRadius: '4px' }}>{calculateTMM(calculateAdjustedMove(mech.move, mech.heat))}</span>
                                )}
                              </div>
                              <div className="inline-edit-group" style={{ padding: '0.15rem 0.25rem', gap: '0.1rem' }}>
                                <label style={{ marginRight: '0.2rem' }}>DMG</label>
                                <input type="text" value={mech.damage?.S || '0'} onChange={(e) => updateMechDmg(mech.id, 'S', e.target.value)} style={{ width: '35px', textAlign: 'center', padding: '0.15rem' }} title="S" />
                                <input type="text" value={mech.damage?.M || '0'} onChange={(e) => updateMechDmg(mech.id, 'M', e.target.value)} style={{ width: '35px', textAlign: 'center', padding: '0.15rem' }} title="M" />
                                <input type="text" value={mech.damage?.L || '0'} onChange={(e) => updateMechDmg(mech.id, 'L', e.target.value)} style={{ width: '35px', textAlign: 'center', padding: '0.15rem' }} title="L" />
                              </div>
                              <div className="heat-control-container">
                                <span className={`stat-badge ${mech.heat > 0 ? 'stat-modified' : ''}`}>Heat: {mech.heat || 0}/4</span>
                                <div className="heat-controls-mini">
                                  <button onClick={() => adjustHeat(mech.id, -1)} disabled={(mech.heat || 0) <= 0}>-</button>
                                  <button onClick={() => adjustHeat(mech.id, 1)} disabled={(mech.heat || 0) >= 4}>+</button>
                                </div>
                              </div>
                            </div>
                            {renderAbilities(mech)}
                          </>
                        )}
                      </div>

                      <div className="mech-actions">
                        {currentPhase === 'iniciativa' && (
                          <div className="edge-btns-right">
                            <button onClick={() => moveToFirst(index)} disabled={index === 0} title="MOVE FIRST" className="move-edge-btn">
                              FIRST
                            </button>
                            <button onClick={() => moveToLast(index)} disabled={index === mechs.length - 1} title="MOVE LAST" className="move-edge-btn">
                              LAST
                            </button>
                          </div>
                        )}
                        {currentPhase === 'mantenimiento' && (
                          <button
                            className="remove-btn"
                            onClick={() => removeMech(mech.id)}
                            title="Eliminar Mech"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="commander-sidebar">
          <div className="commander-persistent-card">
            <h3>COMANDANTE</h3>
            <div className="full-card">
              <img
                src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/assets/Commander/${selectedCommander}/${selectedCommander} ${commanderCard}.png`}
                alt="Commander Card"
              />
            </div>
            <div className="commander-name">{selectedCommander}</div>
          </div>
        </div>
      </main>

      {selectedAbility && (
        <div className="ability-modal-overlay" onClick={() => setSelectedAbility(null)}>
          <div className="ability-modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedAbility(null)}>✕</button>
            <h3>{selectedAbility.original}</h3>
            <h4>{selectedAbility.ability}</h4>
            {selectedAbility.summary && <p className="ability-summary"><strong>Resumen:</strong> {selectedAbility.summary}</p>}
            {selectedAbility.rules && <p className="ability-rules"><strong>Reglas:</strong> {selectedAbility.rules}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
