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
  "juggernaut",
  "missile boat",
  "sniper"
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
