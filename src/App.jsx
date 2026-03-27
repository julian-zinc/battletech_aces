import React, { useState } from 'react';
import { Plus, Trash2, Cpu, RefreshCw } from 'lucide-react';

const MECH_TYPES = [
  "Ambusher (Infantry)",
  "Brawler",
  "Scout",
  "Scout (Hover)",
  "Skirmisher",
  "Skirmisher (JMPS)",
  "Striker",
  "Striker (Hover)",
  "Juggernaut",
  "Missile Boat",
  "Sniper"
];

function App() {
  const [mechs, setMechs] = useState([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(MECH_TYPES[0]);

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

  const drawCard = (id) => {
    setMechs(mechs.map(m => {
      if (m.id === id) {
        const randomNum = Math.floor(Math.random() * 6) + 1;
        // The path should be relative to base URL
        const base = import.meta.env.BASE_URL.replace(/\/$/, ""); // Remove trailing slash if any
        const cardPath = `${base}/assets/${m.type}/${randomNum}.png`;
        return { ...m, currentCard: cardPath };
      }
      return m;
    }));
  };

  return (
    <>
      <header>
        <div className="logo">
          <Cpu size={24} />
          BATTLETECH ACES
        </div>
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
      </header>

      <main>
        {mechs.length === 0 ? (
          <div className="empty-state">
            <p>No hay mechs añadidos. ¡Crea uno para empezar!</p>
          </div>
        ) : (
          mechs.map(mech => (
            <div key={mech.id} className="mech-container">
              <div className="mech-header">
                <div className="mech-info">
                  <div className="mech-type">{mech.type}</div>
                  <h2>{mech.name}</h2>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => removeMech(mech.id)}
                  title="Eliminar Mech"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="draw-section">
                <div className="card-display">
                  {mech.currentCard ? (
                    <img
                      key={mech.currentCard}
                      src={mech.currentCard}
                      alt="Mech Card"
                      className="card-image"
                    />
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>Ninguna carta robada</div>
                  )}
                </div>
                <button className="secondary-btn" onClick={() => drawCard(mech.id)}>
                  <RefreshCw size={18} />
                  Robar Carta
                </button>
              </div>
            </div>
          ))
        )}
      </main>
    </>
  );
}

export default App;
