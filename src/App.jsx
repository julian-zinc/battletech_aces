import React, { useState } from 'react';
import { Plus, Trash2, Cpu, RefreshCw, ChevronUp, ChevronDown, Play, Sword, Zap, User } from 'lucide-react';

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
  const [currentPhase, setCurrentPhase] = useState('mantenimiento'); // mantenimiento, iniciativa, movimiento, iniciativa-combate, combate
  const [activeMechIndex, setActiveMechIndex] = useState(0);

  const addMech = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setMechs([...mechs, {
      id: Date.now(),
      name: newName,
      type: newType,
      currentCard: null
    }]);
    setNewName('');
  };

  const removeMech = (id) => {
    setMechs(mechs.filter(m => m.id !== id));
  };

  const drawAllCards = () => {
    const updatedMechs = mechs.map(m => {
      const randomNum = Math.floor(Math.random() * 6) + 1;
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const cardPath = `${base}/assets/${m.type}/${randomNum}.png`;
      return { ...m, currentCard: cardPath };
    });
    setMechs(updatedMechs);
  };

  const startIniciativa = () => {
    drawAllCards();
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
    drawAllCards();
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
            <form className="add-mech-form" onSubmit={addMech}>
              <input
                type="text"
                placeholder="Nombre del Mech..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <select value={newType} onChange={(e) => setNewType(e.target.value)}>
                {MECH_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <button type="submit">
                <Plus size={18} />
                Añadir
              </button>
            </form>
          )}
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
                  <div key={mech.id} className={`mech-card-view ${currentPhase}`}>
                    <div className="mech-header">
                      <div className="mech-info">
                        <h2>{mech.name}</h2>
                        <span className="mech-type">{mech.type}</span>
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

                    <div className={`card-display-${currentPhase}`}>
                      {mech.currentCard ? (
                        <img
                          src={mech.currentCard}
                          alt="Mech Card"
                          className="card-image"
                        />
                      ) : (
                        <div className="no-card">Ninguna carta robada</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
