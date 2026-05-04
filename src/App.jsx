import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Cpu, RefreshCw, ChevronUp, ChevronDown, Play, Sword, Zap, User } from 'lucide-react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
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
  const [currentSection, setCurrentSection] = useState(localStorage.getItem('isCampaignActive') === 'true' ? 'campana' : 'aces-ia');
  const [campaignCode, setCampaignCode] = useState(localStorage.getItem('lastCampaignCode') || '');
  const [isCampaignActive, setIsCampaignActive] = useState(localStorage.getItem('isCampaignActive') === 'true');
  const [campaignMissions, setCampaignMissions] = useState([]);
  const [campaignMechsList, setCampaignMechsList] = useState([]);
  const [campaignPilots, setCampaignPilots] = useState([]);

  // Campaign Form States
  const emptyMission = { 
    number: '', 
    name: '', 
    date: new Date().toISOString().split('T')[0], 
    won: false, 
    details: '',
    income: { main: 0, other: 0, multiplier: 1 },
    expenses: { recon: 0, waypoints: 0, rearming: 0, injured: 0, newPilots: 0, destroyed: 0, incapacitated: 0, structure: 0, armor: 0 },
    balance: 0 
  };

  const [newMission, setNewMission] = useState(emptyMission);
  const [newCampaignMechName, setNewCampaignMechName] = useState('');
  const [newCampaignMechPV, setNewCampaignMechPV] = useState(0);
  const [newPilot, setNewPilot] = useState({ name: '', sp: 0 });
  const [editingMissionId, setEditingMissionId] = useState(null);
  const [editingPilotId, setEditingPilotId] = useState(null);

  const calculateBalance = (m) => {
    if (!m || !m.income || !m.expenses) return 0;
    const totalIncome = (m.income.main + m.income.other) * m.income.multiplier;
    const totalExpenses = Object.values(m.expenses).reduce((a, b) => a + b, 0);
    return totalIncome - totalExpenses;
  };

  // Sync with Firestore
  useEffect(() => {
    if (isCampaignActive && campaignCode) {
      const unsub = onSnapshot(doc(db, "campaigns", campaignCode.toLowerCase()), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCampaignMissions(data.missions || []);
          setCampaignMechsList(data.mechs || []);
          setCampaignPilots(data.pilots || []);
        } else {
          // Initialize empty campaign if it doesn't exist
          setDoc(doc(db, "campaigns", campaignCode.toLowerCase()), {
            missions: [],
            mechs: [],
            pilots: []
          });
        }
      }, (error) => {
        console.error("[Firebase] Error en listener:", error);
      });
      return () => unsub();
    }
  }, [isCampaignActive, campaignCode]);

  const syncToFirebase = async (updates) => {
    if (!isCampaignActive || !campaignCode) return;
    const docRef = doc(db, "campaigns", campaignCode.toLowerCase());
    try {
      await setDoc(docRef, updates, { merge: true });
    } catch (error) {
      console.error("[Firebase] Firestore sync error:", error);
    }
  };

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

  const addPilot = () => {
    if (!newPilot.name) return;
    const updated = [...campaignPilots, { id: Date.now(), ...newPilot, alive: true }];
    syncToFirebase({ pilots: updated });
    setNewPilot({ name: '', sp: 0 });
  };

  const updatePilot = (id, updates) => {
    const updated = campaignPilots.map(p => p.id === id ? { ...p, ...updates } : p);
    syncToFirebase({ pilots: updated });
  };

  const deletePilot = (id) => {
    const updated = campaignPilots.filter(p => p.id !== id);
    syncToFirebase({ pilots: updated });
  };

  const addCampaignMech = () => {
    if (!newCampaignMechName) return;
    const updated = [...campaignMechsList, { id: Date.now(), name: newCampaignMechName, pv: newCampaignMechPV }];
    syncToFirebase({ mechs: updated });
    setNewCampaignMechName('');
    setNewCampaignMechPV(0);
  };

  const removeCampaignMech = (id) => {
    const updated = campaignMechsList.filter(m => m.id !== id);
    syncToFirebase({ mechs: updated });
  };

  const addMission = () => {
    if (!newMission.name) return;
    const missionToAdd = { ...newMission, id: Date.now(), balance: calculateBalance(newMission) };
    const updated = [...campaignMissions, missionToAdd];
    syncToFirebase({ missions: updated });
    setNewMission(emptyMission);
  };

  const updateMission = (id, updates) => {
    const updated = campaignMissions.map(m => {
      if (m.id === id) {
        const merged = { ...m, ...updates };
        return { ...merged, balance: calculateBalance(merged) };
      }
      return m;
    });
    syncToFirebase({ missions: updated });
  };

  const deleteMission = (id) => {
    const updated = campaignMissions.filter(m => m.id !== id);
    syncToFirebase({ missions: updated });
  };

  const handleEnterCampaign = (e) => {
    e.preventDefault();
    if (campaignCode.trim()) {
      setIsCampaignActive(true);
      localStorage.setItem('lastCampaignCode', campaignCode.toLowerCase());
      localStorage.setItem('isCampaignActive', 'true');
    }
  };

  const handleExitCampaign = () => {
    setIsCampaignActive(false);
    setCampaignCode('');
    setCampaignMissions([]);
    setCampaignMechsList([]);
    setCampaignPilots([]);
    localStorage.removeItem('lastCampaignCode');
    localStorage.removeItem('isCampaignActive');
  };

  const renderCampaignDetail = () => {
    const alivePilots = campaignPilots.filter(p => p.alive);
    const memorialPilots = campaignPilots.filter(p => !p.alive);

    return (
      <div className="campaign-detail-view">
        <div className="campaign-detail-header">
          <h2>DETALLE DE CAMPAÑA</h2>
          <div className="header-campaign-actions">
            <div className="campaign-id-badge">CÓDIGO: {campaignCode.toUpperCase()}</div>
            <button className="exit-btn" onClick={handleExitCampaign}>
              Salir
            </button>
          </div>
        </div>

        <div className="campaign-column">
          <div className="column-header">
            <h3>MISIONES</h3>
            <button className="add-btn-mini" onClick={() => setEditingMissionId('new')}>
              <Plus size={16} /> Añadir
            </button>
          </div>
          
          <div className="mission-list">
            {campaignMissions.length === 0 ? (
              <p className="empty-text">No hay misiones añadidas</p>
            ) : (
              campaignMissions.sort((a,b) => a.number - b.number).map(m => (
                <div key={m.id} className="mission-card" onClick={() => setEditingMissionId(m.id)}>
                  <div className="mission-main-info">
                    <span className="mission-number">#{m.number}</span>
                    <span className="mission-name">{m.name}</span>
                  </div>
                  <div className="mission-sub-info">
                    <span>{m.date}</span>
                    <span className={m.won ? 'victory' : 'defeat'}>{m.won ? 'Victoria' : 'Derrota'}</span>
                    <span className="balance">{m.balance >= 0 ? '+' : ''}{m.balance} SP</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="campaign-column">
          <div className="column-header">
            <h3>MECHS</h3>
            <div className="add-mech-campaign">
              <input 
                type="text" 
                list="mech-suggestions" 
                placeholder="Nombre..." 
                value={newCampaignMechName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewCampaignMechName(val);
                  const found = mechsDB.find(m => m.name === val);
                  if (found) setNewCampaignMechPV(found.pv || 0);
                }}
              />
              <input 
                type="number" 
                placeholder="PV" 
                value={newCampaignMechPV}
                onChange={(e) => setNewCampaignMechPV(parseInt(e.target.value) || 0)}
              />
              <button className="add-btn-mini" onClick={addCampaignMech} disabled={!newCampaignMechName}>
                <Plus size={16} />
              </button>
            </div>
          </div>
          
          <div className="mech-campaign-list">
            {campaignMechsList.length === 0 ? (
              <p className="empty-text">No hay mechs registrados</p>
            ) : (
              campaignMechsList.map(m => (
                <div key={m.id} className="mech-campaign-card">
                  <span className="mech-name">{m.name}</span>
                  <span className="mech-pv">{m.pv} PV</span>
                  <button className="delete-btn-mini" onClick={() => removeCampaignMech(m.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="campaign-column">
          <div className="column-header">
            <h3>PILOTOS</h3>
            <button className="add-btn-mini" onClick={() => setEditingPilotId('new')}>
              <Plus size={16} /> Añadir
            </button>
          </div>
          
          <div className="pilot-list">
            {alivePilots.length === 0 ? (
              <p className="empty-text">No hay pilotos activos</p>
            ) : (
              alivePilots.map(p => (
                <div key={p.id} className="pilot-card" onClick={() => setEditingPilotId(p.id)}>
                  <span className="pilot-name">{p.name}</span>
                  <span className="pilot-sp">{p.sp} SP</span>
                </div>
              ))
            )}
          </div>

          <div className="memorial-section">
            <h4>MEMORIAL</h4>
            <div className="memorial-list">
              {memorialPilots.length === 0 ? (
                <p className="empty-text">El memorial está vacío</p>
              ) : (
                memorialPilots.map(p => (
                  <div key={p.id} className="pilot-card dead" onClick={() => setEditingPilotId(p.id)}>
                    <span className="pilot-name">{p.name}</span>
                    <span className="pilot-sp">{p.sp} SP</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {editingMissionId && (
          <div className="modal-overlay" onClick={() => setEditingMissionId(null)}>
            <div className="modal-content modal-mission-calc" onClick={e => e.stopPropagation()}>
              <h3>{editingMissionId === 'new' ? 'Nueva Misión' : 'Editar Misión'}</h3>
              
              <div className="mission-calc-layout">
                <div className="calc-main-form">
                  <div className="form-row">
                    <input type="number" placeholder="Núm" value={editingMissionId === 'new' ? newMission.number : campaignMissions.find(m => m.id === editingMissionId)?.number} 
                      onChange={e => editingMissionId === 'new' ? setNewMission({...newMission, number: e.target.value}) : updateMission(editingMissionId, {number: e.target.value})} />
                    <input type="text" placeholder="Nombre" className="flex-1" value={editingMissionId === 'new' ? newMission.name : campaignMissions.find(m => m.id === editingMissionId)?.name} 
                      onChange={e => editingMissionId === 'new' ? setNewMission({...newMission, name: e.target.value}) : updateMission(editingMissionId, {name: e.target.value})} />
                    <input type="date" value={editingMissionId === 'new' ? newMission.date : campaignMissions.find(m => m.id === editingMissionId)?.date} 
                      onChange={e => editingMissionId === 'new' ? setNewMission({...newMission, date: e.target.value}) : updateMission(editingMissionId, {date: e.target.value})} />
                  </div>

                  <div className="calc-sections">
                    <div className="calc-group income">
                      <h4>INGRESOS (SP)</h4>
                      <label>Objetivo Principal</label>
                      <input type="number" value={(editingMissionId === 'new' ? newMission.income.main : campaignMissions.find(m => m.id === editingMissionId)?.income.main) || 0} 
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          if (editingMissionId === 'new') setNewMission({...newMission, income: {...newMission.income, main: val}});
                          else updateMission(editingMissionId, {income: {...campaignMissions.find(m => m.id === editingMissionId).income, main: val}});
                        }} />
                      <label>Otros Objetivos</label>
                      <input type="number" value={(editingMissionId === 'new' ? newMission.income.other : campaignMissions.find(m => m.id === editingMissionId)?.income.other) || 0} 
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          if (editingMissionId === 'new') setNewMission({...newMission, income: {...newMission.income, other: val}});
                          else updateMission(editingMissionId, {income: {...campaignMissions.find(m => m.id === editingMissionId).income, other: val}});
                        }} />
                      <label>Multiplicador Dificultad</label>
                      <input type="number" step="0.1" value={(editingMissionId === 'new' ? newMission.income.multiplier : campaignMissions.find(m => m.id === editingMissionId)?.income.multiplier) || 1} 
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 1;
                          if (editingMissionId === 'new') setNewMission({...newMission, income: {...newMission.income, multiplier: val}});
                          else updateMission(editingMissionId, {income: {...campaignMissions.find(m => m.id === editingMissionId).income, multiplier: val}});
                        }} />
                      
                      <div className="calc-subtotal">
                        Total Ingresos: {
                          (((editingMissionId === 'new' ? newMission.income.main : campaignMissions.find(m => m.id === editingMissionId)?.income.main) || 0) + 
                          ((editingMissionId === 'new' ? newMission.income.other : campaignMissions.find(m => m.id === editingMissionId)?.income.other) || 0)) * 
                          ((editingMissionId === 'new' ? newMission.income.multiplier : campaignMissions.find(m => m.id === editingMissionId)?.income.multiplier) || 1)
                        } SP
                      </div>
                    </div>

                    <div className="calc-group expenses">
                      <h4>GASTOS (SP)</h4>
                      <div className="expenses-grid">
                        <div>
                          <label>Recon</label>
                          <input type="number" value={(editingMissionId === 'new' ? newMission.expenses.recon : campaignMissions.find(m => m.id === editingMissionId)?.expenses.recon) || 0} 
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (editingMissionId === 'new') setNewMission({...newMission, expenses: {...newMission.expenses, recon: val}});
                              else updateMission(editingMissionId, {expenses: {...campaignMissions.find(m => m.id === editingMissionId).expenses, recon: val}});
                            }} />
                        </div>
                        <div>
                          <label>Waypoints</label>
                          <input type="number" value={(editingMissionId === 'new' ? newMission.expenses.waypoints : campaignMissions.find(m => m.id === editingMissionId)?.expenses.waypoints) || 0} 
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (editingMissionId === 'new') setNewMission({...newMission, expenses: {...newMission.expenses, waypoints: val}});
                              else updateMission(editingMissionId, {expenses: {...campaignMissions.find(m => m.id === editingMissionId).expenses, waypoints: val}});
                            }} />
                        </div>
                        <div>
                          <label>Rearming</label>
                          <input type="number" value={(editingMissionId === 'new' ? newMission.expenses.rearming : campaignMissions.find(m => m.id === editingMissionId)?.expenses.rearming) || 0} 
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (editingMissionId === 'new') setNewMission({...newMission, expenses: {...newMission.expenses, rearming: val}});
                              else updateMission(editingMissionId, {expenses: {...campaignMissions.find(m => m.id === editingMissionId).expenses, rearming: val}});
                            }} />
                        </div>
                        <div>
                          <label>Personal Herido</label>
                          <input type="number" value={(editingMissionId === 'new' ? newMission.expenses.injured : campaignMissions.find(m => m.id === editingMissionId)?.expenses.injured) || 0} 
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (editingMissionId === 'new') setNewMission({...newMission, expenses: {...newMission.expenses, injured: val}});
                              else updateMission(editingMissionId, {expenses: {...campaignMissions.find(m => m.id === editingMissionId).expenses, injured: val}});
                            }} />
                        </div>
                        <div>
                          <label>Nuevos Pilotos</label>
                          <input type="number" value={(editingMissionId === 'new' ? newMission.expenses.newPilots : campaignMissions.find(m => m.id === editingMissionId)?.expenses.newPilots) || 0} 
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (editingMissionId === 'new') setNewMission({...newMission, expenses: {...newMission.expenses, newPilots: val}});
                              else updateMission(editingMissionId, {expenses: {...campaignMissions.find(m => m.id === editingMissionId).expenses, newPilots: val}});
                            }} />
                        </div>
                        <div>
                          <label>Unid. Destruidas</label>
                          <input type="number" value={(editingMissionId === 'new' ? newMission.expenses.destroyed : campaignMissions.find(m => m.id === editingMissionId)?.expenses.destroyed) || 0} 
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (editingMissionId === 'new') setNewMission({...newMission, expenses: {...newMission.expenses, destroyed: val}});
                              else updateMission(editingMissionId, {expenses: {...campaignMissions.find(m => m.id === editingMissionId).expenses, destroyed: val}});
                            }} />
                        </div>
                        <div>
                          <label>Unid. Incapacitadas</label>
                          <input type="number" value={(editingMissionId === 'new' ? newMission.expenses.incapacitated : campaignMissions.find(m => m.id === editingMissionId)?.expenses.incapacitated) || 0} 
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (editingMissionId === 'new') setNewMission({...newMission, expenses: {...newMission.expenses, incapacitated: val}});
                              else updateMission(editingMissionId, {expenses: {...campaignMissions.find(m => m.id === editingMissionId).expenses, incapacitated: val}});
                            }} />
                        </div>
                        <div>
                          <label>Estructura/Críticos</label>
                          <input type="number" value={(editingMissionId === 'new' ? newMission.expenses.structure : campaignMissions.find(m => m.id === editingMissionId)?.expenses.structure) || 0} 
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (editingMissionId === 'new') setNewMission({...newMission, expenses: {...newMission.expenses, structure: val}});
                              else updateMission(editingMissionId, {expenses: {...campaignMissions.find(m => m.id === editingMissionId).expenses, structure: val}});
                            }} />
                        </div>
                        <div>
                          <label>Armadura</label>
                          <input type="number" value={(editingMissionId === 'new' ? newMission.expenses.armor : campaignMissions.find(m => m.id === editingMissionId)?.expenses.armor) || 0} 
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              if (editingMissionId === 'new') setNewMission({...newMission, expenses: {...newMission.expenses, armor: val}});
                              else updateMission(editingMissionId, {expenses: {...campaignMissions.find(m => m.id === editingMissionId).expenses, armor: val}});
                            }} />
                        </div>
                      </div>
                      
                      <div className="calc-subtotal">
                        Total Gastos: {
                          Object.values((editingMissionId === 'new' ? newMission.expenses : campaignMissions.find(m => m.id === editingMissionId)?.expenses) || {}).reduce((a, b) => a + b, 0)
                        } SP
                      </div>
                    </div>
                  </div>

                  <div className="calc-summary-row">
                    <div className="checkbox-group">
                      <label>Victoria</label>
                      <input type="checkbox" checked={editingMissionId === 'new' ? newMission.won : campaignMissions.find(m => m.id === editingMissionId)?.won} 
                        onChange={e => editingMissionId === 'new' ? setNewMission({...newMission, won: e.target.checked}) : updateMission(editingMissionId, {won: e.target.checked})} />
                    </div>
                    <div className="final-balance-badge">
                      BALANCE AVENTURA: {calculateBalance(editingMissionId === 'new' ? newMission : campaignMissions.find(m => m.id === editingMissionId))} SP
                    </div>
                  </div>

                  <textarea 
                    placeholder="Detalles de la misión..." 
                    className="mission-details-area"
                    value={editingMissionId === 'new' ? newMission.details : campaignMissions.find(m => m.id === editingMissionId)?.details} 
                    onChange={e => editingMissionId === 'new' ? setNewMission({...newMission, details: e.target.value}) : updateMission(editingMissionId, {details: e.target.value})} 
                  />
                </div>
              </div>

              <div className="modal-actions">
                {editingMissionId === 'new' ? (
                  <button onClick={() => { addMission(); setEditingMissionId(null); }}>Guardar Misión</button>
                ) : (
                  <>
                    <button onClick={() => setEditingMissionId(null)}>Cerrar</button>
                    <button className="btn-danger" onClick={() => { deleteMission(editingMissionId); setEditingMissionId(null); }}>Eliminar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {editingPilotId && (
          <div className="modal-overlay" onClick={() => setEditingPilotId(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>{editingPilotId === 'new' ? 'Nuevo Piloto' : 'Editar Piloto'}</h3>
              <div className="form-grid">
                <input type="text" placeholder="Nombre" value={editingPilotId === 'new' ? newPilot.name : campaignPilots.find(p => p.id === editingPilotId)?.name} 
                  onChange={e => editingPilotId === 'new' ? setNewPilot({...newPilot, name: e.target.value}) : updatePilot(editingPilotId, {name: e.target.value})} />
                <input type="number" placeholder="Total SP" value={editingPilotId === 'new' ? newPilot.sp : campaignPilots.find(p => p.id === editingPilotId)?.sp} 
                  onChange={e => editingPilotId === 'new' ? setNewPilot({...newPilot, sp: parseInt(e.target.value) || 0}) : updatePilot(editingPilotId, {sp: parseInt(e.target.value) || 0})} />
                {editingPilotId !== 'new' && (
                  <div className="checkbox-group">
                    <label>Vivo</label>
                    <input type="checkbox" checked={campaignPilots.find(p => p.id === editingPilotId)?.alive} 
                      onChange={e => updatePilot(editingPilotId, {alive: e.target.checked})} />
                  </div>
                )}
              </div>
              <div className="modal-actions">
                {editingPilotId === 'new' ? (
                  <button onClick={() => { addPilot(); setEditingPilotId(null); }}>Guardar</button>
                ) : (
                  <>
                    <button onClick={() => setEditingPilotId(null)}>Cerrar</button>
                    <button className="btn-danger" onClick={() => { deletePilot(editingPilotId); setEditingPilotId(null); }}>Eliminar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

    return (
      <div className={`app-container phase-${currentPhase}`}>
        <datalist id="mech-suggestions">
          {mechsDB.map((m, i) => (
            <option key={i} value={m.name} />
          ))}
        </datalist>
        <header>
        <div className="header-left">
          <div className="logo" onClick={() => { setCurrentSection('aces-ia'); setCurrentPhase('mantenimiento'); }} style={{ cursor: 'pointer' }}>
            <Cpu size={24} />
            BATTLETECH ACES
          </div>

          <div className="section-nav">
            <button
              className={`section-tab ${currentSection === 'aces-ia' ? 'active' : ''}`}
              onClick={() => setCurrentSection('aces-ia')}
            >
              ACES IA
            </button>
            <button
              className={`section-tab ${currentSection === 'campana' ? 'active' : ''}`}
              onClick={() => setCurrentSection('campana')}
            >
              {isCampaignActive ? `CAMPAÑA: ${campaignCode.toUpperCase()}` : 'CAMPAÑA'}
            </button>
          </div>

          {currentSection === 'aces-ia' && (
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
          )}
        </div>

        <div className="header-right">
          {currentSection === 'aces-ia' && currentPhase === 'mantenimiento' && (
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

      <main className={currentSection === 'campana' ? 'campana-main' : ''}>
        {currentSection === 'aces-ia' ? (
          <>
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
          </>
        ) : (
          isCampaignActive ? (
            renderCampaignDetail()
          ) : (
            <div className="campaign-container">
              <div className="campaign-card">
                <h2>Campaña</h2>
                <p>Introduce el código de tu campaña para continuar.</p>
                <form className="campaign-input-group" onSubmit={handleEnterCampaign}>
                  <input
                    type="text"
                    placeholder="Código de campaña..."
                    value={campaignCode}
                    onChange={(e) => setCampaignCode(e.target.value)}
                  />
                  <button className="primary-btn" type="submit">
                    Entrar
                  </button>
                </form>
              </div>
            </div>
          )
        )}
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
