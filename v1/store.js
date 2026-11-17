/* FIIILM — состояние приложения.
   Всё, что пользователь создаёт, живёт здесь и пишется в localStorage.
   Экраны ничего не хранят сами: они рисуются из этого состояния. */

const KEY = 'fiiilm-state-v1';

const EMPTY = {
  signedIn: false,
  user: { name: 'robotcigan', email: 'robotcigan@gmail.com' },
  folders: [],          // {id, name, tags[], roster[], packaging, createdAt}
  favorites: [],        // personId
  notes: {},            // personId -> [{id, text, time}]
  roles: ['DIRECTOR', 'FIRST ASSISTANT DIRECTOR', 'PRODUCER', 'DOP', 'LEAD', 'SUPPORTING'],
  seq: 0,
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(structuredClone(EMPTY), JSON.parse(raw));
  } catch (e) { /* приватный режим или битые данные — начинаем с нуля */ }
  return structuredClone(EMPTY);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

const listeners = [];
function onChange(fn) { listeners.push(fn); }
function commit() { save(); listeners.forEach(fn => fn()); }

function uid(prefix) { return prefix + '-' + (++state.seq); }

/* ---------- папки ---------- */

function newPackaging() {
  return { started: false, closed: false, goal: '', inviteAccess: false, candidates: [] };
}

function createFolder(name, tags) {
  const folder = {
    id: uid('f'), name: name.trim(), tags: tags.slice(),
    roster: [], packaging: newPackaging(), createdAt: Date.now(),
  };
  state.folders.unshift(folder);
  commit();
  return folder;
}

function folder(id) { return state.folders.find(f => f.id === id); }

function updateFolder(id, patch) {
  Object.assign(folder(id), patch);
  commit();
}

function deleteFolder(id) {
  state.folders = state.folders.filter(f => f.id !== id);
  commit();
}

function duplicateFolder(id) {
  const src = folder(id);
  const copy = structuredClone(src);
  copy.id = uid('f');
  copy.name = src.name + ' COPY';
  copy.createdAt = Date.now();
  state.folders.unshift(copy);
  commit();
  return copy;
}

/* ---------- ростер ---------- */

function inRoster(folderId, personId) {
  return folder(folderId).roster.some(r => r.personId === personId);
}

function addToRoster(folderId, personId, dept) {
  const f = folder(folderId);
  if (inRoster(folderId, personId)) return false;
  const person = FIIILM_DATA.byId.person[personId];
  f.roster.push({ personId, dept: dept || person.dept, role: '', addedAt: Date.now() });
  // кандидат появляется и в паккейджинге, если он уже идёт — так в спеке
  if (f.packaging.started && !f.packaging.closed) {
    f.packaging.candidates.push({
      personId, dept: dept || person.dept, role: '', comment: '', parked: false,
    });
  }
  commit();
  return true;
}

/* фильм добавляет в папку всю свою группу — так работает «ADD FROM FOLDER» по смыслу */
function addMovieToRoster(folderId, movieId) {
  const movie = FIIILM_DATA.byId.movie[movieId];
  let n = 0;
  [...movie.crew, ...movie.cast].forEach(([personId]) => {
    if (addToRosterQuiet(folderId, personId)) n++;
  });
  commit();
  return n;
}

function addToRosterQuiet(folderId, personId) {
  const f = folder(folderId);
  if (inRoster(folderId, personId)) return false;
  const person = FIIILM_DATA.byId.person[personId];
  f.roster.push({ personId, dept: person.dept, role: '', addedAt: Date.now() });
  if (f.packaging.started && !f.packaging.closed) {
    f.packaging.candidates.push({ personId, dept: person.dept, role: '', comment: '', parked: false });
  }
  return true;
}

function removeFromRoster(folderId, personId) {
  const f = folder(folderId);
  f.roster = f.roster.filter(r => r.personId !== personId);
  commit();
}

function setRosterRole(folderId, personId, role) {
  const r = folder(folderId).roster.find(r => r.personId === personId);
  if (r) r.role = role;
  commit();
}

function setRosterDept(folderId, personId, dept) {
  const r = folder(folderId).roster.find(r => r.personId === personId);
  if (r) r.dept = dept;
  commit();
}

/* ---------- паккейджинг ---------- */

function startPackaging(folderId, importRoster, inviteAccess) {
  const f = folder(folderId);
  f.packaging = newPackaging();
  f.packaging.started = true;
  f.packaging.inviteAccess = inviteAccess;
  if (importRoster) {
    f.packaging.candidates = f.roster.map(r =>
      ({ personId: r.personId, dept: r.dept, role: r.role, comment: '', parked: false }));
  }
  commit();
}

function candidates(folderId) { return folder(folderId).packaging.candidates; }

function addCandidate(folderId, personId) {
  const p = folder(folderId).packaging;
  if (p.candidates.some(c => c.personId === personId)) return false;
  const person = FIIILM_DATA.byId.person[personId];
  p.candidates.push({ personId, dept: person.dept, role: '', comment: '', parked: false });
  commit();
  return true;
}

function removeCandidate(folderId, personId) {
  const p = folder(folderId).packaging;
  p.candidates = p.candidates.filter(c => c.personId !== personId);
  commit();
}

function setCandidate(folderId, personId, patch) {
  const c = folder(folderId).packaging.candidates.find(c => c.personId === personId);
  if (c) Object.assign(c, patch);
  commit();
}

/* перестановка: кандидат встаёт перед beforeId (или в конец департамента) */
function moveCandidate(folderId, personId, beforeId, dept) {
  const p = folder(folderId).packaging;
  const i = p.candidates.findIndex(c => c.personId === personId);
  const [c] = p.candidates.splice(i, 1);
  if (dept) c.dept = dept;
  const j = beforeId ? p.candidates.findIndex(c => c.personId === beforeId) : -1;
  if (j === -1) p.candidates.push(c); else p.candidates.splice(j, 0, c);
  commit();
}

function setGoal(folderId, text) {
  folder(folderId).packaging.goal = text;
  commit();
}

function setClosed(folderId, closed) {
  folder(folderId).packaging.closed = closed;
  commit();
}

/* ---------- избранное, заметки, роли ---------- */

function toggleFavorite(personId) {
  const i = state.favorites.indexOf(personId);
  if (i === -1) state.favorites.push(personId); else state.favorites.splice(i, 1);
  commit();
  return i === -1;
}

function isFavorite(personId) { return state.favorites.includes(personId); }

function notesOf(personId) { return state.notes[personId] || []; }

function saveNote(personId, noteId, text) {
  const list = state.notes[personId] = state.notes[personId] || [];
  const time = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  const found = list.find(n => n.id === noteId);
  if (found) { found.text = text; found.time = time; }
  else list.unshift({ id: uid('n'), text, time });
  commit();
}

function deleteNote(personId, noteId) {
  state.notes[personId] = notesOf(personId).filter(n => n.id !== noteId);
  commit();
}

function addRole(role) {
  const r = role.trim().toUpperCase();
  if (r && !state.roles.includes(r)) state.roles.push(r);
  commit();
  return r;
}

function signIn() { state.signedIn = true; commit(); }

function reset() {
  state = structuredClone(EMPTY);
  commit();
}

window.FIIILM_STORE = {
  get state() { return state; },
  onChange, commit,
  createFolder, folder, updateFolder, deleteFolder, duplicateFolder,
  inRoster, addToRoster, addMovieToRoster, removeFromRoster, setRosterRole, setRosterDept,
  startPackaging, candidates, addCandidate, removeCandidate, setCandidate, moveCandidate,
  setGoal, setClosed,
  toggleFavorite, isFavorite, notesOf, saveNote, deleteNote, addRole,
  signIn, reset,
};
