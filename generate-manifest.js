import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, 'public', 'assets');
const manifestPath = path.join(__dirname, 'src', 'cardManifest.json');

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
  "Missile boat",
  "Sniper"
];

const manifest = {};

MECH_TYPES.forEach(type => {
  const typeDir = path.join(assetsDir, type);
  if (fs.existsSync(typeDir)) {
    const files = fs.readdirSync(typeDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
    manifest[type] = files;
  } else {
    manifest[type] = [];
    console.warn(`Directory not found for ${type}`);
  }
});

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Manifest written to ${manifestPath}`);

const mechsDbPath = path.join(__dirname, 'src', 'mechsDB.json');

function parseCSVLine(line) {
  const result = [];
  let inQuotes = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i+1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const csvPath = path.join(assetsDir, 'mechs.csv');
if (fs.existsSync(csvPath)) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  const mechsDB = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length > 25) {
      let name = row[1];
      const nameMatch = name.match(/=hyperlink\([^,]+,\s*"([^"]+)"\)/i);
      if (nameMatch) {
         name = nameMatch[1];
      }
      const overheat = parseInt(row[19]) || 0;
      const role = row[25] || '';
      const move = row[8] || '';
      const imagelink = row[21] || '';
      
      const formatDmg = (dmg, min) => {
        if (dmg === '0' && min === '1') return '0*';
        if (!dmg) return '0';
        return dmg;
      };
      
      const damage = {
        S: formatDmg(row[11], row[12]),
        M: formatDmg(row[13], row[14]),
        L: formatDmg(row[15], row[16])
      };

      const abilities = row[20] || '';

      mechsDB.push({ name, overheat, role, move, imagelink, damage, abilities });
    }
  }
  
  fs.writeFileSync(mechsDbPath, JSON.stringify(mechsDB, null, 2));
  console.log(`MechsDB written to ${mechsDbPath}`);
}

const specialCsvPath = path.join(assetsDir, 'special.csv');
const specialDbPath = path.join(__dirname, 'src', 'specialDB.json');

if (fs.existsSync(specialCsvPath)) {
  const content = fs.readFileSync(specialCsvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  const specialDB = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length >= 4) {
      specialDB.push({
        abbreviation: row[0],
        ability: row[1],
        summary: row[2],
        rules: row[3]
      });
    }
  }
  
  fs.writeFileSync(specialDbPath, JSON.stringify(specialDB, null, 2));
  console.log(`SpecialDB written to ${specialDbPath}`);
}
