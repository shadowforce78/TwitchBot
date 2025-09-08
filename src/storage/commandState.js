const fs = require('fs');
const path = require('path');

// Fichier: data/command-state.json au niveau racine du projet
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'command-state.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState() {
  try {
    if (!fs.existsSync(FILE_PATH)) return { disabled: [] };
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const json = JSON.parse(raw);
    if (!json || !Array.isArray(json.disabled)) return { disabled: [] };
    return json;
  } catch (e) {
    console.warn('[commands][state] Lecture échouée:', e.message);
    return { disabled: [] };
  }
}

function applyState(registry) {
  const state = loadState();
  const disabledSet = new Set(state.disabled.map(n => n.toLowerCase()));
  registry.forEach(cmd => {
    if (disabledSet.has(cmd.name.toLowerCase())) cmd.enabled = false; else if (typeof cmd.enabled === 'undefined') cmd.enabled = true;
  });
  return state;
}

function snapshot(registry) {
  const disabled = registry.filter(c => c.enabled === false).map(c => c.name).sort();
  return { disabled };
}

function saveState(registry) {
  try {
    ensureDir();
    const data = snapshot(registry);
    const tmp = FILE_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, FILE_PATH);
    return true;
  } catch (e) {
    console.error('[commands][state] Sauvegarde échouée:', e.message);
    return false;
  }
}

module.exports = { loadState, applyState, saveState, snapshot, FILE_PATH };
