import React, { useState } from 'react';
import { Plus, Trash2, Cpu, RefreshCw, ChevronUp, ChevronDown, Play, Sword, Zap, User } from 'lucide-react';
import cardManifest from './cardManifest.json';
import mechsDB from './mechsDB.json';

const MECH_TYPES = [
  "Ambusher (Infantry)",
  "Brawler",
  "Scout",
  "Scout (Hover)",
  "Skirmisher",
  "Skirmisher (JMPS)",
  "Striker",
  "Striker (Hover)",
  "juggernaut",
  "missile boat",
  "sniper"
];

function App() {
  const [mechs, setMechs] = useState([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(MECH_TYPES[0]);
  const [newOV, setNewOV] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('mantenimiento'); // mantenimiento, iniciativa, movimiento, iniciativa-combate, combate
  const [activeMechIndex, setActiveMechIndex] = useState(0);
  const [selectedCommander, setSelectedCommander] = useState("Mechwarrior Clan Jade Falcon");
  const [commanderCard, setCommanderCard] = useState("A");
  const [draggedIndex, setDraggedIndex] = useState(null);

  const addMech = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setMechs([...mechs, {
      id: Date.now(),
      name: newName,
      type: newType,
      ov: parseInt(newOV) || 0,
      heat: 0,
      currentCard: null
    }]);
    setNewName('');
    setNewOV(0);
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
    if (activeMechIndex < mechs.length - 1) {
      setActiveMechIndex(activeMechIndex + 1);
    }
  };

  const startIniciativaCombate = () => {
    const sorted = [...mechs].sort((a, b) => (a.comInit || 0) - (b.comInit || 0));
    setMechs(sorted);
    setCurrentPhase('iniciativa-combate');
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

  const onDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Simple swap during drag for feedback or just wait for drop
    // We'll wait for drop for simplicity as per user request to "reorder by dragging"
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

  return (
    <div className={`app-container phase-${currentPhase}`}>
      <header>
        <div className="header-left">
          <div className="logo" onClick={() => setCurrentPhase('mantenimiento')} style={{cursor: 'pointer'}}>
            <Cpu size={24} />
            BATTLETECH ACES
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
              className={`phase-btn ${currentPhase === 'iniciativa-combate' ? 'active' : ''}`} 
              onClick={startIniciativaCombate}
              disabled={mechs.length === 0}
            >
              <Zap size={18} /> Iniciativa Combate
            </button>
            <button 
              className={`phase-btn ${currentPhase === 'combate' ? 'active' : ''}`} 
              onClick={() => {
                setCurrentPhase('combate');
                setActiveMechIndex(0);
              }}
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
              <datalist id="mech-suggestions">
                {mechsDB.map((m, i) => (
                  <option key={i} value={m.name} />
                ))}
              </datalist>
              <input
                type="text"
                list="mech-suggestions"
                placeholder="Nombre del Mech..."
                value={newName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewName(val);
                  const found = mechsDB.find(m => m.name === val);
                  if (found) {
                    setNewOV(found.overheat || 0);
                    const roleLower = (found.role || '').toLowerCase();
                    const matchType = MECH_TYPES.find(t => t.toLowerCase() === roleLower) || MECH_TYPES.find(t => t.toLowerCase().startsWith(roleLower));
                    if (matchType) {
                      setNewType(matchType);
                    }
                  }
                }}
              />
              <select value={newType} onChange={(e) => setNewType(e.target.value)}>
                {MECH_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
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
              <button type="submit">
                <Plus size={18} />
                Añadir
              </button>
            </form>
          </>)}
        </div>
      </header>

      <main>
        {currentPhase === 'mantenimiento' && mechs.length === 0 ? (
          <div className="empty-state">
            <p>No hay mechs añadidos. ¡Crea uno para empezar!</p>
          </div>
        ) : (
          <div className="content-area">
            {currentPhase === 'movimiento' || currentPhase === 'combate' ? (
              <div className="movement-phase">
                <div className="movement-sidebar">
                  {mechs.map((m, i) => (
                    <div 
                      key={m.id} 
                      className={`sidebar-item ${i === activeMechIndex ? 'active' : ''} ${i < activeMechIndex ? 'completed' : ''}`}
                    >
                      <div className="sidebar-info">
                        <span className="sidebar-name">{m.name}</span>
                        <span className="sidebar-type">{m.type}</span>
                        <div className="sidebar-stats">
                          <span className="stat-badge">OV: {m.ov || 0}</span>
                          <span className="stat-badge">Heat: {m.heat || 0}/4</span>
                        </div>
                      </div>
                      <div className={`card-display-sidebar ${currentPhase}`}>
                        {m.currentCard && <img src={m.currentCard} alt="Mech Header" />}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="movement-main">
                  <div className="active-mech-display">
                      <div className="mech-header">
                        <h2>{mechs[activeMechIndex]?.name}</h2>
                        <span className="mech-type">{mechs[activeMechIndex]?.type}</span>
                        <div className="principal-stats">
                          <span className="stat-badge">OV: {mechs[activeMechIndex]?.ov || 0}</span>
                          <div className="heat-control-container">
                            <span className="stat-badge">Heat: {mechs[activeMechIndex]?.heat || 0}/4</span>
                            {currentPhase === 'combate' && (
                              <div className="heat-controls-mini">
                                <button onClick={() => adjustHeat(mechs[activeMechIndex].id, -1)} disabled={(mechs[activeMechIndex]?.heat || 0) <= 0}>-</button>
                                <button onClick={() => adjustHeat(mechs[activeMechIndex].id, 1)} disabled={(mechs[activeMechIndex]?.heat || 0) >= 4}>+</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`card-display-principal ${currentPhase}`}>
                        {mechs[activeMechIndex]?.currentCard && (
                          <img src={mechs[activeMechIndex].currentCard} alt="Mech Card" />
                        )}
                      </div>
                      <div className="movement-nav">
                        <button className="secondary-btn" onClick={prevMech} disabled={activeMechIndex === 0}>
                          Anterior
                        </button>
                        <div className="mech-counter">
                          {activeMechIndex + 1} / {mechs.length}
                        </div>
                        {activeMechIndex === mechs.length - 1 ? (
                          <button 
                            className="primary-btn phase-transition" 
                            onClick={() => {
                              if (currentPhase === 'movimiento') startIniciativaCombate();
                              else setCurrentPhase('mantenimiento');
                            }}
                          >
                            {currentPhase === 'movimiento' ? (
                              <><Zap size={18} /> Iniciativa Combate</>
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
                  </div>
                </div>
              </div>
            ) : (
              <div className={`mechs-grid ${currentPhase}`}>
                {mechs.map((mech, index) => (
                  <div 
                    key={mech.id} 
                    className={`mech-card-view ${currentPhase}`}
                    draggable={currentPhase === 'iniciativa' || currentPhase === 'iniciativa-combate'}
                    onDragStart={(e) => onDragStart(e, index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    onDrop={(e) => onDrop(e, index)}
                  >
                    <div className="mech-header">
                      <div className={`card-display-${currentPhase}`}>
                        {mech.currentCard ? (
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
                        <h2>{mech.name}</h2>
                        <span className="mech-type">{mech.type}</span>
                        <div className="grid-stats">
                          <span className="stat-badge">OV: {mech.ov || 0}</span>
                          <div className="heat-control-container">
                            <span className="stat-badge">Heat: {mech.heat || 0}/4</span>
                            {(currentPhase === 'mantenimiento' || currentPhase === 'combate') && (
                              <div className="heat-controls-mini">
                                <button onClick={() => adjustHeat(mech.id, -1)} disabled={(mech.heat || 0) <= 0}>-</button>
                                <button onClick={() => adjustHeat(mech.id, 1)} disabled={(mech.heat || 0) >= 4}>+</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mech-actions">
                        {(currentPhase === 'iniciativa' || currentPhase === 'iniciativa-combate') && (
                          <div className="reorder-btns">
                            <button onClick={() => moveMech(index, -1)} disabled={index === 0}>
                              <ChevronUp size={16} />
                            </button>
                            <button onClick={() => moveMech(index, 1)} disabled={index === mechs.length - 1}>
                              <ChevronDown size={16} />
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
    </div>
  );
}

export default App;
