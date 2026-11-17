/* FIIILM v2 — состояние приложения.
   Главное отличие от v1: папка стала проектом. Отдельного ростера нет,
   содержимое папки — это и есть личный рейтинг (my picks). Лайки стали
   сохранёнками: личный отложенный список, в нём и люди, и фильмы. */

const KEY = 'fiiilm-state-v7';

const ME = { id: 'me', name: 'ME', weight: 2, me: true, photo: 'u-me.jpg', access: 'owner' };

/* Доступ к проекту — как в шаринге Фигмы (гипотеза дизайнера, ноябрь 2026).
   edit — ранжирует, добавляет, меняет статусы и голосует; view — только смотрит,
   в общем рейтинге не участвует. По ссылке можно открыть только на просмотр. */
const ACCESS = [
  { id: 'edit', label: 'EDIT' },
  { id: 'view', label: 'VIEW' },
];

const EMPTY = {
  signedIn: false,
  user: { name: 'robotcigan', email: 'robotcigan@gmail.com' },
  folders: [],
  collections: [],      // подборки сохранёнок: {id, name, people[], movies[], createdAt}
  notes: {},
  /* роли каста — это и есть группы внутри проекта. Свои роли (имя персонажа)
     добавляются в конец каста; роли съёмочной группы всегда идут последними */
  roles: ['MAIN MALE', 'MAIN FEMALE'],
  seq: 0,
};

/* Группировка в касте — по ролям (вторая встреча). Режиссёры и операторы — в конце. */
const CREW_ROLES = ['DIRECTOR', 'DOP'];
const DEFAULT_ROLE = { DIRECTING: 'DIRECTOR', CAMERA: 'DOP' };

/* статусы кандидата: менять может любой участник, запоминаем кто и когда */
const STATUSES = [
  { id: 'available',   label: 'AVAILABLE' },
  { id: 'thinking',    label: 'THINKING' },
  { id: 'unavailable', label: 'UNAVAILABLE' },
];

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(structuredClone(EMPTY), JSON.parse(raw));
  } catch (e) {}
  return structuredClone(EMPTY);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

const listeners = [];
function onChange(fn) { listeners.push(fn); }
function commit() { save(); listeners.forEach(fn => fn()); }

function uid(p) { return p + '-' + (++state.seq); }

/* ---------- папки-проекты ---------- */

function createFolder(name, tags) {
  const f = {
    id: uid('f'),
    name: name.trim(),
    tags: tags.slice(),
    createdAt: Date.now(),
    members: [structuredClone(ME)],
    candidates: [],            // {personId, role, status, statusBy, statusAt, comments, parked, addedBy}
    ranks: { me: [] },         // memberId -> порядок personId
    goal: '',
    closed: false,
    link: 'none',              // доступ по ссылке: none | view
  };
  state.folders.unshift(f);
  commit();
  return f;
}

function folder(id) { return state.folders.find(f => f.id === id); }

function updateFolder(id, patch) { Object.assign(folder(id), patch); commit(); }

function deleteFolder(id) {
  state.folders = state.folders.filter(f => f.id !== id);
  commit();
}

/* папка считается общей, когда в ней есть кто-то кроме меня */
function isShared(f) { return f.members.length > 1; }

/* голосуют владелец и редакторы; зрители в рейтинг не входят */
function voters(f) { return f.members.filter(m => (m.access || 'edit') !== 'view'); }

function invite(folderId, emails, access) {
  const f = folder(folderId);
  const added = [];
  emails.forEach(email => {
    const e = email.trim().toLowerCase();
    if (!e || f.members.some(m => m.email === e)) return;
    const m = { id: uid('u'), name: e.split('@')[0].toUpperCase(), email: e, weight: 1, access, invited: true };
    f.members.push(m);
    f.ranks[m.id] = [];
    added.push(m);
  });
  commit();
  return added;
}

function setAccess(folderId, memberId, access) {
  const m = folder(folderId).members.find(m => m.id === memberId);
  if (m && !m.me) m.access = access;
  commit();
}

function removeMember(folderId, memberId) {
  const f = folder(folderId);
  f.members = f.members.filter(m => m.id !== memberId || m.me);
  delete f.ranks[memberId];
  commit();
}

function setLink(folderId, link) { folder(folderId).link = link; commit(); }

function addCandidate(folderId, personId, byId = 'me', role) {
  const f = folder(folderId);
  if (f.candidates.some(c => c.personId === personId)) return false;
  const person = FIIILM_DATA.byId.person[personId];
  f.candidates.push({
    personId, role: role !== undefined ? role : (DEFAULT_ROLE[person.dept] || ''), status: '', statusBy: '', statusAt: 0,
    comments: {}, parked: false, addedBy: byId,
  });
  f.members.forEach(m => {
    f.ranks[m.id] = f.ranks[m.id] || [];
    if (m.id === byId) f.ranks[m.id].push(personId);
  });
  commit();
  return true;
}

function removeCandidate(folderId, personId) {
  const f = folder(folderId);
  f.candidates = f.candidates.filter(c => c.personId !== personId);
  Object.keys(f.ranks).forEach(k => (f.ranks[k] = f.ranks[k].filter(id => id !== personId)));
  commit();
}

/* комментарий пишет каждый участник свой — в team picks видны все */
function setComment(folderId, personId, memberId, text) {
  const c = folder(folderId).candidates.find(c => c.personId === personId);
  if (!c) return;
  c.comments = c.comments || {};
  if (text) c.comments[memberId] = text; else delete c.comments[memberId];
  commit();
}

function commentsOf(c) {
  return Object.entries(c.comments || {}).map(([id, text]) => ({ id, text }));
}

function setCandidate(folderId, personId, patch) {
  const c = folder(folderId).candidates.find(c => c.personId === personId);
  if (c) Object.assign(c, patch);
  commit();
}

function hasCandidate(folderId, personId) {
  return folder(folderId).candidates.some(c => c.personId === personId);
}

/* мой порядок: список кандидатов в порядке ranks.me, остальные в конец */
function myPicks(f) {
  const order = f.ranks.me || [];
  const seen = new Set(order);
  return [...order.map(id => f.candidates.find(c => c.personId === id)).filter(Boolean),
          ...f.candidates.filter(c => !seen.has(c.personId))];
}

/* порядок после жеста перетаскивания: DOM уже перестроен,
   поэтому сохраняем тихо, без перерисовки — иначе анимация сорвётся.
   В DOM есть не все: скрытые фильтром и отложенные остаются на своих местах,
   а видимые занимают освободившиеся места в новом порядке. */
function setMyPicks(folderId, entries) {
  const f = folder(folderId);
  const old = myPicks(f).map(c => c.personId);
  const shown = new Set(entries.map(e => e.personId));
  const next = entries.map(e => e.personId);
  f.ranks.me = old.map(id => (shown.has(id) ? next.shift() : id));
  entries.forEach(e => setCandidate0(f, e.personId, { role: e.role }));
  save();
}

function setCandidate0(f, personId, patch) {
  const c = f.candidates.find(c => c.personId === personId);
  if (c) Object.assign(c, patch);
}

function setStatus(folderId, personId, status, byId = 'me') {
  setCandidate0(folder(folderId), personId, { status, statusBy: byId, statusAt: Date.now() });
  commit();
}

/* порядок групп: роли каста по списку ролей, потом «без роли», потом съёмочная группа */
function roleOrder(role) {
  const crew = CREW_ROLES.indexOf(role);
  if (crew !== -1) return 2000 + crew;
  if (!role) return 1000;
  const i = state.roles.indexOf(role);
  return i === -1 ? 999 : i;
}

function isCrewRole(role) { return CREW_ROLES.includes(role); }

/* ---------- общий рейтинг ----------
   Формула из спеки: score = avg + (1 − coverage) × 1000.
   Позиции считаются внутри роли, начиная с первой. */

function positionsOf(f, memberId) {
  const order = f.ranks[memberId] || [];
  const perDept = {};
  const out = {};
  order.forEach(id => {
    const c = f.candidates.find(c => c.personId === id);
    if (!c || c.parked) return;
    perDept[c.role] = (perDept[c.role] || 0) + 1;
    out[id] = perDept[c.role];
  });
  return out;
}

function teamScore(f, personId) {
  const totalW = voters(f).reduce((s, m) => s + m.weight, 0);
  let wsum = 0, wpos = 0;
  const votes = [];
  voters(f).forEach(m => {
    const pos = positionsOf(f, m.id)[personId];
    if (!pos) return;
    wsum += m.weight;
    wpos += m.weight * pos;
    votes.push({ member: m, pos });
  });
  if (!wsum) return { score: Infinity, votes, coverage: 0 };
  const avg = wpos / wsum;
  const coverage = wsum / totalW;
  return { score: avg + (1 - coverage) * 1000, votes, coverage, avg };
}

function teamPicks(f) {
  return f.candidates
    .filter(c => !c.parked)
    .map(c => ({ ...c, ...teamScore(f, c.personId) }))
    .sort((a, b) => a.score - b.score);
}

/* ---------- сохранёнки: личные подборки ----------
   Подборка — это не проект: в ней нет участников, рейтинга и голосов,
   только то, что ты отложил на потом. Люди и фильмы лежат вместе. */

function collection(id) { return state.collections.find(c => c.id === id); }

function createCollection(name) {
  const c = { id: uid('c'), name: name.trim(), people: [], movies: [], createdAt: Date.now() };
  state.collections.unshift(c);
  commit();
  return c;
}

function deleteCollection(id) {
  state.collections = state.collections.filter(c => c.id !== id);
  commit();
}

/* в каких подборках лежит элемент */
function collectionsOf(kind, id) {
  return state.collections.filter(c => c[kind].includes(id)).map(c => c.id);
}

function isSaved(kind, id) { return collectionsOf(kind, id).length > 0; }

/* выставляет членство целиком: элемент лежит ровно в выбранных подборках */
function setCollections(kind, id, ids) {
  state.collections.forEach(c => {
    const has = c[kind].includes(id);
    const want = ids.includes(c.id);
    if (want && !has) c[kind].unshift(id);
    if (!want && has) c[kind] = c[kind].filter(x => x !== id);
  });
  commit();
}

function removeFromCollection(colId, kind, id) {
  const c = collection(colId);
  c[kind] = c[kind].filter(x => x !== id);
  commit();
}

/* все сохранённые люди без дублей — из них предлагаем добавлять в проект */
function savedPeople() {
  const seen = new Set();
  state.collections.forEach(c => c.people.forEach(id => seen.add(id)));
  return [...seen];
}

/* ---------- заметки и роли ---------- */

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
  if (r && !state.roles.includes(r) && !CREW_ROLES.includes(r)) state.roles.push(r);
  commit();
  return r;
}

/* роль в конкретном касте: переименовать — перевесить всех её кандидатов на новое имя.
   Список ролей общий (подсказки), поэтому старое имя заменяем в нём на месте,
   только если оно больше нигде не используется. */
function renameRole(folderId, from, to) {
  const r = to.trim().toUpperCase();
  if (!r || r === from) return from;
  const f = folder(folderId);
  f.candidates.forEach(c => { if (c.role === from) c.role = r; });
  if (!CREW_ROLES.includes(r) && !state.roles.includes(r)) {
    const i = state.roles.indexOf(from);
    const usedElsewhere = state.folders.some(x => x.candidates.some(c => c.role === from));
    if (i !== -1 && !usedElsewhere) state.roles[i] = r; else state.roles.push(r);
  }
  commit();
  return r;
}

/* удалить роль из каста — вместе со всеми, кто в ней */
function deleteRole(folderId, role) {
  const f = folder(folderId);
  const gone = f.candidates.filter(c => c.role === role).map(c => c.personId);
  f.candidates = f.candidates.filter(c => c.role !== role);
  Object.keys(f.ranks).forEach(k => (f.ranks[k] = f.ranks[k].filter(id => !gone.includes(id))));
  commit();
  return gone.length;
}

/* ---------- демо-состояние ----------
   Приложение открывается залогиненным, с двумя папками и сохранёнками.
   Участники и их голоса выдуманы: приглашений в прототипе нет. */

function seed() {
  state = structuredClone(EMPTY);
  state.signedIn = true;

  const roles = (fid, map) => Object.entries(map).forEach(([role, ids]) =>
    ids.forEach(id => setCandidate0(folder(fid), id, { role })));
  const statuses = (fid, map) => Object.entries(map).forEach(([id, [status, by]]) =>
    setCandidate0(folder(fid), id, { status, statusBy: by, statusAt: Date.now() - 3600e3 }));

  // Проект только со мной
  const solo = createFolder('Test', ['ACTION']);
  ['holland', 'pattinson', 'stone', 'hathaway', 'nolan', 'tarantino', 'linus', 'skip']
    .forEach(id => addCandidate(solo.id, id));
  roles(solo.id, { 'MAIN MALE': ['holland', 'pattinson'], 'MAIN FEMALE': ['stone', 'hathaway'] });
  statuses(solo.id, { holland: ['available', 'me'], stone: ['thinking', 'me'], nolan: ['unavailable', 'me'] });
  setComment(solo.id, 'stone', 'me', 'Ждём ответ агента');
  solo.goal = '';

  // Проект с командой — как на макете folders-list
  const team = createFolder('The Odyssey', ['ACTION']);
  team.members = [
    structuredClone(ME),
    { id: 'alex', name: 'ALEX', email: 'alex@fiiilm.app', weight: 2, photo: 'u-alex.jpg', access: 'edit' },
    { id: 'polina', name: 'POLINA', email: 'polina@fiiilm.app', weight: 1, photo: 'u-polina.jpg', access: 'edit' },
    { id: 'egor', name: 'EGOR', email: 'egor@fiiilm.app', weight: 1, access: 'view' },
  ];
  team.link = 'view';
  team.goal = 'SET UP YOUR PLAN';
  addRole('TELEMACHUS');   // роли сразу именами персонажей
  addRole('PENELOPE');

  const picks = {
    me:     ['holland', 'damon', 'stone', 'zendaya', 'charlize', 'pattinson', 'cillian', 'hathaway', 'nolan', 'tarantino', 'hoyte', 'linus'],
    alex:   ['damon', 'holland', 'zendaya', 'stone', 'cillian', 'pattinson', 'hathaway', 'nolan', 'tarantino', 'linus'],
    polina: ['holland', 'zendaya', 'stone', 'charlize', 'pattinson', 'nolan', 'hoyte'],
  };
  const owners = {
    holland: 'alex', damon: 'me', stone: 'polina', zendaya: 'me', charlize: 'me', hathaway: 'alex',
    nolan: 'me', tarantino: 'me', hoyte: 'polina', linus: 'alex', pattinson: 'alex', cillian: 'me',
  };
  [...new Set(Object.values(picks).flat())].forEach(id => addCandidate(team.id, id, owners[id] || 'me'));
  team.ranks = structuredClone(picks);
  roles(team.id, {
    'MAIN MALE': ['holland', 'damon'],
    'MAIN FEMALE': ['stone', 'zendaya', 'charlize'],
    'TELEMACHUS': ['pattinson', 'cillian'],
    'PENELOPE': ['hathaway'],
  });
  statuses(team.id, {
    holland: ['available', 'alex'], damon: ['thinking', 'me'], stone: ['unavailable', 'polina'],
    zendaya: ['available', 'polina'], charlize: ['thinking', 'me'], hathaway: ['thinking', 'alex'],
    pattinson: ['available', 'alex'], cillian: ['thinking', 'polina'],
    nolan: ['available', 'me'], tarantino: ['unavailable', 'alex'], hoyte: ['available', 'polina'],
  });
  setComment(team.id, 'nolan', 'me', 'Если согласится — вопрос закрыт');
  setComment(team.id, 'nolan', 'alex', 'Дорого, но тянет весь блок');
  setComment(team.id, 'holland', 'polina', 'Сильная проба, занят до мая');
  setComment(team.id, 'stone', 'alex', 'Не наш типаж');
  setComment(team.id, 'zendaya', 'polina', 'Согласна на пробы в декабре');

  // личные подборки — без участников и рейтинга
  const refs = createCollection('References');
  refs.movies = ['odyssey', 'sinners', 'oppenheimer', 'dune2', 'madmax'];
  refs.people = ['nolan', 'denis'];
  const ops = createCollection('Cinematographers');
  ops.people = ['hoyte', 'linus', 'rodrigo', 'darius'];
  const cast = createCollection('Casting ideas');
  cast.people = ['damon', 'cillian', 'florence', 'travis', 'charlize'];
  cast.movies = ['challengers'];
  state.notes.nolan = [{ id: uid('n'), text: 'Звонить через агента, не напрямую', time: '10:43' }];

  commit();
}

function reset() { seed(); }

if (!state.signedIn && !state.folders.length) seed();

window.FIIILM_STORE = {
  get state() { return state; },
  onChange, commit, reset,
  createFolder, folder, updateFolder, deleteFolder, isShared,
  voters, invite, setAccess, removeMember, setLink, ACCESS,
  addCandidate, removeCandidate, setCandidate, hasCandidate, setComment, commentsOf,
  myPicks, setMyPicks, teamPicks, teamScore, positionsOf,
  collection, createCollection, deleteCollection, collectionsOf, isSaved,
  setCollections, removeFromCollection, savedPeople,
  notesOf, saveNote, deleteNote, addRole, renameRole, deleteRole,
  setStatus, roleOrder, isCrewRole, CREW_ROLES, STATUSES,
};
