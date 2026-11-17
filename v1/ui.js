/* FIIILM — экраны и переходы.
   Ни один экран не захардкожен: всё рисуется из FIIILM_STORE.state.
   Действия помечены в разметке как data-act="имя", обработчики лежат в ACTIONS. */

const D = window.FIIILM_DATA;
const S = window.FIIILM_STORE;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ic = (name, cls = 'ic') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

/* временное состояние интерфейса: запросы, фильтры, открытый оверлей.
   Намеренно не сохраняется — это не данные пользователя. */
const ui = {
  q: {},            // поисковые запросы по экранам
  deptFilter: {},   // выбранные департаменты по папкам
  sort: null,
  overlay: null,
  overlayArg: null,
  sheetPicked: [],
  editingNote: null,
  dragId: null,
};

/* ---------- маршрут ---------- */

function route() {
  const parts = (location.hash.slice(1) || '').split('/').filter(Boolean);
  return { name: parts[0] || '', a: parts[1], b: parts[2] };
}

function go(hash) { location.hash = hash; }

/* ---------- общие куски ---------- */

function photo(person, cls = 'row__photo') {
  return person.photo
    ? `<img class="${cls}" src="assets/${person.photo}" alt="">`
    : `<div class="${cls}"></div>`;
}

function poster(movie, cls = 'row__photo') {
  return movie.poster
    ? `<img class="${cls}" src="assets/${movie.poster}" alt="">`
    : `<div class="${cls}"></div>`;
}

function navbar(back, right = '') {
  return `<div class="navbar">
    <button data-act="go" data-arg="${back}">${ic('chevron-left', 'ic ic--lg')}</button>
    ${right ? `<div class="nav-actions" style="margin-left:auto">${right}</div>` : ''}
  </div>`;
}

function tabbar(active) {
  const tab = (key, hash, icon, label) => `
    <button data-act="go" data-arg="${hash}" class="${active === key ? 'is-active' : ''}">
      ${ic(icon, active === key ? 'ic' : 'ic ic--muted')}${label ? `<span>${label}</span>` : ''}
    </button>`;
  return `<nav class="tabbar">
    ${tab('search', 'search', 'search', 'SEARCH')}
    ${tab('new', 'folder-new', 'plus', '')}
    ${tab('folders', 'folders', 'folder', 'FOLDERS')}
  </nav>`;
}

function searchField(scope, placeholder) {
  const v = ui.q[scope] || '';
  return `<div class="search-field">
    <input class="search-field__input" type="text" data-q="${scope}"
           value="${esc(v)}" placeholder="${placeholder}">
    ${v ? `<button class="search-field__clear" data-act="clearQ" data-arg="${scope}">${ic('close')}</button>` : ''}
  </div>`;
}

/* строка человека в списке */
function personRow(p, opts = {}) {
  const sub = opts.sub !== undefined ? opts.sub : `${p.known.toUpperCase()}, ${p.year}`;
  return `<div class="row" data-act="go" data-arg="person/${p.id}">
    ${photo(p, 'row__photo' + (opts.small ? ' row__photo--sm' : ''))}
    <div class="row__body">
      <div class="row__name">${esc(p.name)}</div>${opts.role ? `<span class="row__role">${esc(opts.role)}</span>` : ''}
      ${sub ? `<div class="row__sub">${esc(sub)}</div>` : ''}
      ${opts.tag !== false ? `<div class="row__tag">[${p.dept}]</div>` : ''}
    </div>
    <div class="row__actions${opts.stack ? ' row__actions--stack' : ''}">${opts.actions || ''}</div>
  </div>`;
}

function emptyState(title, buttonLabel, act, arg) {
  return `<div class="scroll" style="display:flex">
    <div class="empty">
      <p class="display">${title}</p>
      ${buttonLabel ? `<button class="btn" style="background:var(--bg-accent);color:var(--text-on-accent)"
        data-act="${act}" ${arg ? `data-arg="${arg}"` : ''}>${buttonLabel}</button>` : ''}
    </div>
  </div>`;
}

/* ============================ ЭКРАНЫ ============================ */

const SCREENS = {

  signin() {
    return `<div class="scroll pad" style="display:flex;flex-direction:column;justify-content:center">
        <p class="display">FILM LOVERS ARE SICK PEOPLE.<br>&mdash;F. TRUFFAUT</p>
        <button class="btn btn--primary" style="margin-top:34px" data-act="signIn">SIGN IN</button>
        <p class="caption" style="margin-top:16px;text-align:center">
          Вход условный: нажми и начнёшь с нуля &mdash; 0 папок.</p>
      </div>`;
  },

  folders() {
    const list = S.state.folders;
    const q = (ui.q.folders || '').trim().toUpperCase();
    const shown = q ? list.filter(f => f.name.toUpperCase().includes(q)) : list;

    const head = `
      <div class="profile-strip">
        <div class="avatar" data-act="go" data-arg="profile">${S.state.user.name[0].toUpperCase()}</div>
        <span class="name">${S.state.user.name.toUpperCase()}</span>
        <button data-act="overlay" data-arg="profile-menu">${ic('more')}</button>
      </div>`;

    if (!list.length) {
      return head + emptyState('NO FOLDERS<br>YET', 'CREATE FOLDER', 'go', 'folder-new') + tabbar('folders');
    }

    return head + `
      <div class="pad">
        ${searchField('folders', 'FIND FOLDER')}
        <div style="margin-top:14px">
          <button class="btn-filter btn-filter--off" data-act="toast"
                  data-arg="Экрана фильтров в приложении я не видел">FILTER</button>
        </div>
      </div>
      <div class="scroll pad">
        ${shown.length ? shown.map(f => `
          <div class="folder-row" data-act="go" data-arg="f/${f.id}">
            <div>
              <span class="title">${esc(f.name)}</span>
              <div class="meta">
                ${f.tags.map(t => `<span class="caption" style="color:var(--text-primary)">[${esc(t)}]</span>`).join('')}
                ${f.packaging.started ? '<span class="caption" style="color:var(--text-primary)">PACKAGING</span>' : ''}
              </div>
            </div>
            <button data-act="overlay" data-arg="folder-menu:${f.id}">${ic('more')}</button>
          </div>`).join('')
        : '<div class="no-results">Ничего не найдено</div>'}
      </div>` + tabbar('folders');
  },

  'folder-new'() {
    const tags = ui.newTags || (ui.newTags = []);
    return `
      <div class="navbar">
        <span class="nav-title px">NEW FOLDER</span>
        <button style="background:var(--bg-subtle);padding:8px;margin-left:auto"
                data-act="go" data-arg="folders">${ic('close', 'ic ic--sm')}</button>
      </div>
      <div class="pad" style="padding-top:12px">
        <p class="label">NAME YOUR FOLDER</p>
        <div class="search-field" style="margin-top:14px">
          <input class="search-field__input search-field__input--sm" type="text"
                 id="folder-name" value="${esc(ui.newName || '')}" placeholder="FOLDER NAME">
        </div>
        <p class="label" style="margin-top:30px">ADD TAGS</p>
        <div class="search-field" style="margin-top:14px">
          <input class="search-field__input search-field__input--tag" type="text"
                 id="folder-tag" placeholder="ADD TAGS">
          <button data-act="addTag">${ic('plus')}</button>
        </div>
        <div class="chips" style="margin-top:12px;flex-wrap:wrap;gap:6px;overflow:visible">
          ${tags.map((t, i) => `<span class="chip chip--outline" data-act="dropTag" data-arg="${i}">${esc(t)} &times;</span>`).join('')}
        </div>
      </div>
      <div class="scroll"></div>
      <div class="pad" style="padding-bottom:10px">
        <button class="btn btn--primary" data-act="createFolder">CREATE FOLDER</button>
      </div>
      ${keyboard('done')}`;
  },

  f(id, tab) {
    const f = S.folder(id);
    if (!f) return SCREENS.folders();
    return tab === 'pack' ? folderPackaging(f)
      : tab === 'add-people' ? folderAddPeople(f)
      : tab === 'add-movies' ? folderAddMovies(f)
      : folderRoster(f);
  },

  search() {
    const q = ui.q.search || '';
    const ppl = D.searchPeople(q);
    const mov = D.searchMovies(q);
    const plus = id => `<button data-act="pick" data-arg="${id}" data-stop="1">${ic('plus')}</button>`;

    return `
      <div class="pad" style="padding-top:18px">
        ${searchField('search', 'SEARCH BY NAME, GENRE, TAG')}
      </div>
      <div class="scroll pad">
        ${!q.trim() ? `<p class="caption" style="padding-top:20px">
            Ищется по каталогу прототипа: ${D.people.length} человек и ${D.movies.length} фильмов.
            Попробуй «nolan», «odyssey», «acting», «2024».</p>` : `
          <div class="section-head"><span class="h2">SPECIALISTS (${ppl.length})</span></div>
          ${ppl.length ? ppl.map(p => personRow(p, { actions: plus(p.id) })).join('')
            : '<div class="no-results">No specialists found</div>'}
          <div class="section-head" style="margin-top:10px"><span class="h2">MOVIES (${mov.length})</span></div>
          ${mov.length ? mov.map(m => movieRow(m)).join('')
            : '<div class="no-results">No movies found</div>'}`}
      </div>` + tabbar('search');
  },

  person(id) {
    const p = D.byId.person[id];
    if (!p) return SCREENS.folders();
    const credits = D.creditsOf(id);
    const fav = S.isFavorite(id);
    return navbar('back', `
        <button data-act="toggleFav" data-arg="${id}">${ic('heart', fav ? 'ic' : 'ic ic--muted')}</button>
        <button data-act="overlay" data-arg="share:${esc(p.name)}">${ic('share')}</button>
        <button data-act="overlay" data-arg="person-menu:${id}">${ic('more')}</button>`) + `
      ${p.photo ? `<img class="person-hero" src="assets/${p.photo}" alt="">`
                : '<div class="person-hero"></div>'}
      <div class="scroll pad">
        <h2 class="title" style="margin-top:14px">${esc(p.name)}</h2>
        <p class="caption" style="margin-top:6px">[${p.dept}]</p>
        ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
        <div class="section-head" style="margin-top:18px">
          <span class="h2">DISCOGRAPHY (${credits.length})</span>
        </div>
        <div class="disco">
          ${credits.map(c => `
            <figure data-act="go" data-arg="movie/${c.movie.id}">
              ${poster(c.movie, '')}
              <figcaption>${esc(c.movie.title.toUpperCase())}</figcaption>
              <div class="year">${c.movie.year}</div>
            </figure>`).join('')}
        </div>
      </div>
      <div class="footer-bar">
        <button class="btn btn--outline" data-act="pick" data-arg="${id}">ADD TO FOLDER</button>
        <button data-act="go" data-arg="notes/${id}">${ic('note', 'ic ic--lg')}</button>
      </div>`;
  },

  movie(id, tab) {
    const m = D.byId.movie[id];
    if (!m) return SCREENS.folders();
    const isCast = tab === 'cast';
    const list = isCast ? m.cast : m.crew;
    const depts = [...new Set(list.map(([pid]) => D.byId.person[pid].dept))];
    const filter = ui.movieDept;
    const rows = list.filter(([pid]) => !filter || D.byId.person[pid].dept === filter);

    const grouped = {};
    rows.forEach(([pid, role]) => (grouped[D.byId.person[pid].dept] = grouped[D.byId.person[pid].dept] || []).push([pid, role]));

    return navbar('back', `<button data-act="overlay" data-arg="share:${esc(m.title)}">${ic('share')}</button>`) + `
      <div class="movie-hero">
        <div class="movie-hero__bg"${m.poster ? ` style="background-image:url(assets/${m.poster})"` : ''}></div>
        <p class="movie-hero__top">${m.year} &nbsp;Directed by ${directorOf(m)}</p>
        <h2 class="movie-hero__title">${esc(m.title)}</h2>
        ${m.tagline ? `<p class="movie-hero__tagline">${esc(m.tagline)}</p>` : ''}
        <div class="movie-hero__stats">
          <div><b>${m.tmdb}</b><span>TMDB</span></div>
          <div><b>${m.rated}</b><span>RATED</span></div>
          <div><b>${m.runtime}</b><span>RUNTIME</span></div>
        </div>
        <p class="movie-hero__meta">${m.country} &middot; ${m.genres.join(' &middot; ')}</p>
      </div>
      <div class="tabs-line">
        <button class="${!isCast ? 'is-active' : ''}" data-act="go" data-arg="movie/${id}/crew">Crew</button>
        <span class="dot">&middot;</span>
        <button class="${isCast ? 'is-active' : ''}" data-act="go" data-arg="movie/${id}/cast">Cast</button>
        <span class="dot">&middot;</span>
        <button data-act="toast" data-arg="Вкладки Details в скриншотах не было">Details</button>
      </div>
      <div class="pad" style="padding-top:12px">
        <div class="chips">
          ${depts.map(d => `<span class="chip chip--outline${filter === d ? ' is-on' : ''}"
            data-act="movieDept" data-arg="${d}">${d}</span>`).join('')}
        </div>
      </div>
      <div class="scroll pad">
        ${Object.entries(grouped).map(([dept, items]) => `
          <div class="dept-head">${dept}</div>
          ${items.map(([pid, role]) => {
            const p = D.byId.person[pid];
            return personRow(p, { small: true, sub: role, tag: false,
              actions: `<button data-act="pick" data-arg="${pid}" data-stop="1">${ic('plus', 'ic ic--muted')}</button>` });
          }).join('')}`).join('')}
      </div>`;
  },

  notes(pid) {
    const p = D.byId.person[pid];
    const list = S.notesOf(pid);
    return `
      <div class="navbar navbar--bordered" style="height:62px">
        <div style="display:flex;align-items:center;gap:12px">
          ${photo(p, 'avatar')}
          <div>
            <div style="font-size:17px;font-weight:600;color:var(--text-primary)">${esc(titleCase(p.name))}</div>
            <div class="mono" style="font-size:13px;letter-spacing:.12em;color:var(--text-muted)">${p.dept}</div>
          </div>
        </div>
        <button data-act="go" data-arg="person/${pid}">${ic('close', 'ic ic--lg')}</button>
      </div>
      <div class="scroll">
        ${list.length ? list.map(n => `
          <div class="note-item" data-act="go" data-arg="note/${pid}/${n.id}">
            <div class="bar"></div>
            <div class="body">
              <div class="text">${esc(n.text)}</div>
              <div class="time">${n.time}</div>
            </div>
            <button data-act="deleteNote" data-arg="${pid}:${n.id}" data-stop="1">${ic('trash', 'ic ic--sm ic--muted')}</button>
          </div>`).join('')
        : '<p class="caption" style="padding:20px var(--gutter)">Заметок пока нет.</p>'}
      </div>
      <div class="footer-bar footer-bar--single">
        <button class="btn btn--outline" style="border-color:var(--border-default)"
                data-act="go" data-arg="note/${pid}/new">ADD NOTE</button>
      </div>`;
  },

  note(pid, nid) {
    const p = D.byId.person[pid];
    const existing = nid !== 'new' ? S.notesOf(pid).find(n => n.id === nid) : null;
    return `
      <div class="navbar navbar--bordered">
        <button class="px nav-act" data-act="go" data-arg="notes/${pid}">CANCEL</button>
        <span style="font-size:17px;font-weight:600;color:var(--text-primary);position:absolute;left:50%;transform:translateX(-50%)">${esc(titleCase(p.name))}</span>
        <button class="px nav-act" data-act="saveNote" data-arg="${pid}:${nid}">SAVE</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:12px var(--gutter)">
        ${ic('at', 'ic ic--sm')}
        <span style="font-size:15px;color:var(--text-muted)">Type @ to mention a specialist</span>
      </div>
      <div class="note-editor">
        <div class="bar"></div>
        <textarea id="note-text" placeholder="Write your note...">${esc(existing ? existing.text : '')}</textarea>
      </div>
      ${keyboard('return')}`;
  },

  profile() {
    const favs = S.state.favorites.map(id => D.byId.person[id]).filter(Boolean);
    const depts = [...new Set(favs.map(p => p.dept))];
    const filter = ui.favDept;
    const shown = filter ? favs.filter(p => p.dept === filter) : favs;
    return navbar('folders', `<button data-act="overlay" data-arg="profile-menu">${ic('more')}</button>`) + `
      <div class="scroll">
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 0 10px">
          <div class="avatar avatar--lg">${S.state.user.name[0].toUpperCase()}</div>
          <h2 class="title">${esc(S.state.user.name)}</h2>
          <p style="font-size:15px;color:var(--text-muted)">${esc(S.state.user.email)}</p>
          <button class="btn btn--sf" style="background:var(--bg-subtle);color:var(--text-primary);padding:10px 26px;margin-top:4px"
                  data-act="toast" data-arg="Экрана правки профиля в скриншотах нет">Edit Profile</button>
        </div>
        <div class="pad" style="margin-top:14px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="h2" style="letter-spacing:.06em">FAVORITES (${favs.length})</span>
          </div>
          ${depts.length ? `<div class="chips" style="margin-top:14px">
            ${depts.map(d => `<span class="chip chip--soft${filter === d ? ' is-on' : ''}"
              data-act="favDept" data-arg="${d}">${titleCase(d)}</span>`).join('')}
          </div>` : ''}
          <div style="border-bottom:1px solid var(--border-default);margin-top:14px"></div>
          ${shown.length ? shown.map(p => personRow(p, { stack: true,
              actions: `<button data-act="toggleFav" data-arg="${p.id}" data-stop="1">${ic('heart', 'ic ic--sm')}</button>` })).join('')
            : '<p class="caption" style="padding-top:20px">Избранного пока нет. Добавь кого-нибудь с карточки человека.</p>'}
        </div>
      </div>
      <div class="footer-bar" style="background:var(--bg-subtle)">
        <button class="btn--sf" style="color:var(--text-danger);font-size:17px"
                data-act="toast" data-arg="Удаление аккаунта в прототипе не делаем">Delete Account</button>
      </div>`;
  },
};

/* ---------- папка: ростер ---------- */

function folderRoster(f) {
  const filter = ui.deptFilter[f.id];
  const rows = f.roster.filter(r => !filter || r.dept === filter);
  const depts = [...new Set(f.roster.map(r => r.dept))];
  const groups = groupBy(rows, r => r.dept, ui.sort);

  return navbar('folders', `
      <button data-act="overlay" data-arg="share:${esc(f.name)}">${ic('share')}</button>
      <button data-act="overlay" data-arg="folder-menu:${f.id}">${ic('more')}</button>`) + `
    <div class="tabs-line">
      <button class="is-active">ROSTER</button>
      <button data-act="go" data-arg="f/${f.id}/pack">PACKAGING</button>
    </div>
    <div class="pad">
      <h2 class="title">${esc(f.name)}</h2>
      ${f.tags.length ? `<p class="caption" style="margin-top:8px">${f.tags.map(t => `[${esc(t)}]`).join(' ')}</p>` : ''}
      ${depts.length > 1 ? `<div class="chips" style="margin-top:14px">
        ${depts.map(d => `<span class="chip chip--outline${filter === d ? ' is-on' : ''}"
          data-act="rosterDept" data-arg="${f.id}:${d}">${d}</span>`).join('')}
      </div>` : ''}
    </div>
    ${!f.roster.length
      ? `<div class="scroll" style="display:flex"><div class="empty">
           <p class="display">NOBODY HERE<br>YET</p></div></div>`
      : `<div class="scroll pad">
          ${groups.map(([dept, items]) => `
            <div class="dept-head">${dept}</div>
            ${items.map(r => {
              const p = D.byId.person[r.personId];
              return `<div class="row" style="align-items:center" data-act="go" data-arg="person/${p.id}">
                ${photo(p)}
                <div class="row__body">
                  <div class="row__name">${esc(p.name)}</div>${r.role ? `<span class="row__role">${esc(r.role)}</span>` : ''}
                  <div class="row__tag" style="margin-top:8px">[${r.dept}]</div>
                </div>
                <div class="row__actions row__actions--stack">
                  <button data-act="overlay" data-arg="row-menu:${f.id}:${p.id}" data-stop="1">${ic('more', 'ic ic--muted')}</button>
                  <button data-act="overlay" data-arg="role:${f.id}:${p.id}:roster" data-stop="1">${ic('tag', 'ic ic--muted')}</button>
                </div>
              </div>`;
            }).join('')}`).join('')}
        </div>`}
    <div class="footer-bar">
      <button class="btn btn--outline" data-act="go" data-arg="f/${f.id}/add-people">ADD CONTENT</button>
      <button data-act="overlay" data-arg="sort">${ic('sort', 'ic ic--lg')}</button>
    </div>`;
}

/* ---------- папка: паккейджинг ---------- */

function folderPackaging(f) {
  const p = f.packaging;
  const head = navbar('folders', `
      <button data-act="overlay" data-arg="share:${esc(f.name)}">${ic('share')}</button>
      <button data-act="overlay" data-arg="folder-menu:${f.id}">${ic('more')}</button>`) + `
    <div class="tabs-line">
      <button data-act="go" data-arg="f/${f.id}">ROSTER</button>
      <button class="is-active">PACKAGING</button>
    </div>`;

  if (!p.started) {
    return head + `<div class="scroll" style="display:flex"><div class="empty">
        <p class="display">PACK IT UP,<br>TOGETHER!</p>
        <button class="btn" style="background:var(--bg-accent);color:var(--text-on-accent)"
                data-act="overlay" data-arg="start-pack:${f.id}">START PACKAGING</button>
      </div></div>`;
  }

  const filter = ui.deptFilter['pack-' + f.id];
  const cands = p.candidates.filter(c => !c.parked && (!filter || c.dept === filter));
  const parked = p.candidates.filter(c => c.parked);
  const depts = [...new Set(p.candidates.filter(c => !c.parked).map(c => c.dept))];
  const groups = groupBy(cands, c => c.dept, ui.sort);

  return head + `
    <div class="pad${p.closed ? ' is-closed' : ''}">
      <h2 class="title">${esc(f.name)}</h2>
      <div class="pack-head">
        <span class="pack-chip" style="color:var(--text-primary)">[1 PARTICIPANT]</span>
        <button class="pack-chip ${p.closed ? 'reopen' : 'danger'}"
                data-act="${p.closed ? 'reopenPack' : 'overlay'}"
                data-arg="${p.closed ? f.id : 'close-pack:' + f.id}">
          [${p.closed ? 'REOPEN' : 'CLOSE'} PACKAGING]</button>
      </div>
      <div class="goal">
        <div style="flex:1;min-width:0">
          <div class="caption" style="font-size:var(--fs-body)">GOAL</div>
          <textarea id="goal-text" class="plan" rows="1" maxlength="1000"
                    placeholder="SET UP YOUR PLAN" ${p.closed ? 'readonly' : ''}
                    data-folder="${f.id}">${esc(p.goal)}</textarea>
        </div>
        <button data-act="focusGoal">${ic('pencil')}</button>
      </div>
    </div>
    <div class="tabs-line" style="padding-top:18px">
      <button class="is-active">MY LIST</button>
      <button data-act="toast" data-arg="AGGREGATE появляется, когда участников больше одного">AGGREGATE</button>
    </div>
    <div class="scroll pad${p.closed ? ' is-closed' : ''}${filter ? ' is-filtered' : ''}">
      ${p.closed ? '' : `
        <button class="link-row" data-act="go" data-arg="f/${f.id}/add-people">${ic('plus')}ADD NEW SPECIALIST</button>
        <button class="link-row" data-act="importRoster" data-arg="${f.id}">${ic('import')}ADD FROM ROSTER</button>`}
      ${depts.length > 1 ? `<div class="chips" style="margin:10px 0 4px">
        ${depts.map(d => `<span class="chip chip--outline${filter === d ? ' is-on' : ''}"
          data-act="packDept" data-arg="${f.id}:${d}">${d}</span>`).join('')}
      </div>` : ''}
      ${!p.candidates.length
        ? '<p class="caption" style="padding-top:20px">No candidates yet. Add specialists to start ranking.</p>'
        : groups.map(([dept, items]) => `
            <div class="dept-head" data-dept="${dept}">${dept}</div>
            ${items.map(c => candRow(f, c)).join('')}`).join('')}
      ${parked.length ? `<div class="dept-head dept-head--muted">PARKED</div>
        ${parked.map(c => candRow(f, c)).join('')}` : ''}
    </div>`;
}

function candRow(f, c) {
  const p = D.byId.person[c.personId];
  return `<div class="cand-row${c.parked ? ' is-muted' : ''}" data-cand="${c.personId}"
               data-act="go" data-arg="person/${p.id}">
    ${photo(p, 'row__photo row__photo--xs')}
    <div class="cand-row__body">
      <div class="row__name">${esc(p.name)}</div>${c.role ? `<span class="row__role">${esc(c.role)}</span>` : ''}
      <button class="cand-row__comment" data-act="overlay" data-arg="reason:${f.id}:${c.personId}" data-stop="1"
              ${c.comment ? 'style="color:var(--text-primary)"' : ''}>
        ${ic('pencil', 'ic ic--sm ic--muted')}${c.comment ? esc(c.comment) : 'ADD COMMENT'}</button>
    </div>
    <button data-act="overlay" data-arg="cand-menu:${f.id}:${c.personId}" data-stop="1">${ic('more', 'ic ic--muted')}</button>
    <button data-act="overlay" data-arg="role:${f.id}:${c.personId}:pack" data-stop="1">${ic('tag', 'ic ic--muted')}</button>
    <button class="drag-handle" draggable="true" data-stop="1">${ic('drag', 'ic ic--muted')}</button>
  </div>`;
}

/* ---------- папка: добавление ---------- */

function folderAddPeople(f) {
  const q = ui.q['add-people'] || '';
  const found = D.searchPeople(q);
  return navbar(`f/${f.id}`) + `
    <div class="pad">
      <p class="label">ADD TO &laquo;${esc(f.name)}&raquo;</p>
      <div style="margin-top:12px">${searchField('add-people', 'FIND SPECIALIST')}</div>
      <div class="tabs-line" style="padding:14px 0 0">
        <button class="is-active">PEOPLE</button>
        <button data-act="go" data-arg="f/${f.id}/add-movies">MOVIES</button>
      </div>
    </div>
    <div class="scroll pad">
      ${!q.trim() ? '<p class="caption" style="padding-top:20px">Начни вводить имя, роль или фильм.</p>'
        : found.length ? found.map(p => {
          const added = S.inRoster(f.id, p.id);
          return personRow(p, { actions: added
            ? '<span class="fav-badge">Added</span>'
            : `<button data-act="addPerson" data-arg="${f.id}:${p.id}" data-stop="1">${ic('plus')}</button>` });
        }).join('')
        : '<div class="no-results">No specialists found</div>'}
    </div>`;
}

function folderAddMovies(f) {
  const q = ui.q['add-movies'] || '';
  const found = D.searchMovies(q);
  return navbar(`f/${f.id}`) + `
    <div class="pad">
      <p class="label">ADD TO &laquo;${esc(f.name)}&raquo;</p>
      <div style="margin-top:12px">${searchField('add-movies', 'FIND MOVIE')}</div>
      <div class="tabs-line" style="padding:14px 0 0">
        <button data-act="go" data-arg="f/${f.id}/add-people">PEOPLE</button>
        <button class="is-active">MOVIES</button>
      </div>
    </div>
    <div class="scroll pad">
      ${!q.trim() ? '<p class="caption" style="padding-top:20px">Фильм добавит в папку всю свою группу и актёров.</p>'
        : found.length ? found.map(m => movieRow(m, `
            <button data-act="addMovie" data-arg="${f.id}:${m.id}" data-stop="1">${ic('plus')}</button>`)).join('')
        : '<div class="no-results">No movies found</div>'}
    </div>`;
}

function movieRow(m, actions = '') {
  return `<div class="row" data-act="go" data-arg="movie/${m.id}">
    ${poster(m)}
    <div class="row__body">
      <div class="row__name">${esc(m.title.toUpperCase())}</div>
      <div class="row__sub">${m.year}</div>
      <div class="row__tag">[${m.genres[0]}]</div>
    </div>
    <div class="row__actions">${actions}</div>
  </div>`;
}

/* ---------- клавиатура ---------- */

function keyboard(goKey) {
  const row = (keys, style = '') =>
    `<div class="kb-row"${style}>${keys.map(k =>
      `<div class="kb-key${k.length > 1 ? ' kb-key--dark' : ''}">${k}</div>`).join('')}</div>`;
  return `<div class="keyboard">
    <div class="kb-suggest"><div>I</div><div>The</div><div>I&rsquo;m</div></div>
    ${row([...'QWERTYUIOP'])}
    ${row([...'ASDFGHJKL'], ' style="padding-left:16px;padding-right:16px"')}
    ${row(['⇧', ...'ZXCVBNM', '⌫'])}
    <div class="kb-row">
      <div class="kb-key kb-key--dark" style="flex:1.4;font-size:14px">123</div>
      <div class="kb-key kb-key--dark" style="flex:1">☺</div>
      <div class="kb-key kb-key--wide">space</div>
      <div class="kb-key kb-key--go">${goKey}</div>
    </div>
    <div class="kb-bottom"><span>🌐</span><span>🎤</span></div>
  </div>`;
}

/* ============================ ОВЕРЛЕИ ============================ */

function renderOverlay() {
  const box = $('#overlays');
  if (!ui.overlay) { box.innerHTML = ''; return; }
  const [kind, ...args] = ui.overlayArg;
  box.innerHTML = `<div class="overlay is-open">
    <div class="overlay__scrim" data-act="closeOverlay"></div>
    ${OVERLAYS[kind] ? OVERLAYS[kind](...args) : ''}
  </div>`;
}

const OVERLAYS = {
  'select-folder'(personId) {
    const list = S.state.folders;
    return `<div class="sheet">
      <div class="sheet__grabber"></div>
      <div class="sheet__label">SELECT FOLDER</div>
      ${list.map(f => `
        <div class="sheet-row" data-act="pickFolder" data-arg="${f.id}">
          <span><span class="px">${esc(f.name.toUpperCase())}</span>
          ${f.packaging.started ? '<span class="badge-pack">Packaging</span>' : ''}</span>
          <span class="checkbox${ui.sheetPicked.includes(f.id) ? ' is-on' : ''}"></span>
        </div>`).join('')}
      <div class="sheet-row" data-act="go" data-arg="folder-new">
        <span style="display:flex;align-items:center;gap:10px">${ic('plus')}<span class="px">NEW FOLDER</span></span>
      </div>
      <div class="sheet__footer">
        <button class="btn btn--primary${ui.sheetPicked.length ? '' : ' btn--disabled'}"
                data-act="confirmPick" data-arg="${personId}">ADD</button>
      </div>
    </div>`;
  },

  role(folderId, personId, where) {
    const f = S.folder(folderId);
    const src = where === 'pack'
      ? f.packaging.candidates.find(c => c.personId === personId)
      : f.roster.find(r => r.personId === personId);
    const p = D.byId.person[personId];
    return `<div class="sheet" style="padding-bottom:20px">
      <div class="sheet__grabber"></div>
      <div style="text-align:center">
        <div style="font-size:19px;font-weight:600;color:var(--text-primary)">${esc(titleCase(p.name))}</div>
        <div style="font-size:15px;color:var(--text-muted);margin-top:2px">Role</div>
      </div>
      <div style="margin-top:10px;max-height:300px;overflow:auto">
        ${['', ...S.state.roles].map(r => `
          <button class="role-row${(src && src.role) === r ? ' is-on' : ''}"
                  data-act="setRole" data-arg="${folderId}:${personId}:${where}:${encodeURIComponent(r)}">
            ${ic('check')}<span>${r || 'No role'}</span>
          </button>`).join('')}
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <input id="role-new" type="text" placeholder="New role"
               style="flex:1;border:1px solid var(--border-default);padding:13px 14px;font-size:17px;color:var(--text-primary);outline:none;background:none">
        <button data-act="addRole" data-arg="${folderId}:${personId}:${where}"
                style="border:1px solid var(--border-default);padding:13px 20px;font-size:17px;color:var(--text-primary)">Add</button>
      </div>
    </div>`;
  },

  'folder-menu'(folderId) {
    return `<div class="menu" style="right:14px;top:120px">
      <button data-act="duplicateFolder" data-arg="${folderId}">${ic('copy', 'ic ic--sm')}DUPLICATE</button>
      <button data-act="overlay" data-arg="share:папку">${ic('share', 'ic ic--sm')}SHARE</button>
      <button class="is-danger" data-act="deleteFolder" data-arg="${folderId}">${ic('trash', 'ic ic--sm ic--danger')}DELETE</button>
    </div>`;
  },

  'row-menu'(folderId, personId) {
    return `<div class="menu" style="right:14px;top:300px">
      <button data-act="go" data-arg="notes/${personId}">${ic('note', 'ic ic--sm')}ADD NOTE</button>
      <button data-act="toggleFav" data-arg="${personId}">${ic('heart', 'ic ic--sm')}${S.isFavorite(personId) ? 'REMOVE FROM' : 'ADD TO'} FAVORITES</button>
      <button class="is-danger" data-act="removePerson" data-arg="${folderId}:${personId}">${ic('trash', 'ic ic--sm ic--danger')}REMOVE FROM FOLDER</button>
    </div>`;
  },

  'cand-menu'(folderId, personId) {
    const c = S.folder(folderId).packaging.candidates.find(c => c.personId === personId);
    return `<div class="menu" style="right:14px;top:300px">
      <button data-act="parkCand" data-arg="${folderId}:${personId}">${ic('eye', 'ic ic--sm')}${c.parked ? 'UNPARK' : 'PARK'} CANDIDATE</button>
      <button data-act="go" data-arg="notes/${personId}">${ic('note', 'ic ic--sm')}ADD NOTE</button>
      <button class="is-danger" data-act="removeCand" data-arg="${folderId}:${personId}">${ic('trash', 'ic ic--sm ic--danger')}DELETE CANDIDATE</button>
    </div>`;
  },

  'profile-menu'() {
    return `<div class="menu" style="right:14px;top:70px">
      <button data-act="go" data-arg="profile">${ic('more', 'ic ic--sm')}PROFILE</button>
      <button data-act="toast" data-arg="FIIILM — прототип">${ic('note', 'ic ic--sm')}ABOUT APP</button>
    </div>`;
  },

  'person-menu'(personId) {
    return `<div class="menu" style="right:14px;top:70px">
      <button data-act="pick" data-arg="${personId}">${ic('plus', 'ic ic--sm')}ADD TO FOLDER</button>
      <button data-act="go" data-arg="notes/${personId}">${ic('note', 'ic ic--sm')}NOTES</button>
    </div>`;
  },

  sort() {
    const opt = (key, label) =>
      `<button data-act="setSort" data-arg="${key}" class="${ui.sort === key ? 'is-on' : ''}">${label}</button>`;
    return `<div class="menu" style="right:14px;bottom:96px;min-width:250px">
      ${opt('role-az', 'ROLES BY A-Z')}
      ${opt('role-za', 'ROLES BY Z-A')}
      ${opt('count-desc', 'BY COUNT (FROM MORE)')}
      ${opt('count-asc', 'BY COUNT (FROM LESS)')}
      ${opt('recent', 'BY RECENT UPDATE')}
    </div>`;
  },

  'start-pack'(folderId) {
    const f = S.folder(folderId);
    const on = ui.packImport !== false;
    const invite = !!ui.packInvite;
    return `<div class="dialog">
      <div class="dialog__label">START PACKAGING</div>
      <div class="dialog__opt" data-act="toggleImport">
        <div class="head"><span class="px">IMPORT ROSTER</span><span class="checkbox${on ? ' is-on' : ''}"></span></div>
        <div class="hint">MERGES CURRENT ROSTER INTO PACKAGING (${f.roster.length} ЧЕЛ.)</div>
      </div>
      <div class="dialog__opt" data-act="toggleInvite">
        <div class="head"><span class="px">INVITE ACCESS</span><span class="checkbox${invite ? ' is-on' : ''}"></span></div>
        <div class="hint">ПРИГЛАШЕНИЙ В ПРОТОТИПЕ НЕТ — ФЛАЖОК БЕЗ ПОСЛЕДСТВИЙ</div>
      </div>
      <div class="dialog__actions">
        <button class="btn btn--outline" data-act="closeOverlay">CANCEL</button>
        <button class="btn" style="background:var(--bg-accent);color:var(--text-on-accent)"
                data-act="startPack" data-arg="${folderId}">START</button>
      </div>
    </div>`;
  },

  'close-pack'(folderId) {
    return `<div class="ios-alert">
      <div class="body">
        <h3>Close Packaging?</h3>
        <p>Participants will see the process as closed and read-only.</p>
      </div>
      <div class="actions">
        <button data-act="closeOverlay">Cancel</button>
        <button data-act="closePack" data-arg="${folderId}">Close</button>
      </div>
    </div>`;
  },

  reason(folderId, personId) {
    const c = S.folder(folderId).packaging.candidates.find(c => c.personId === personId);
    const p = D.byId.person[personId];
    return `<div class="dialog dialog--sf">
      <h3>Reason</h3>
      <p>Why you ranked ${esc(titleCase(p.name))} like this — visible to all participants.</p>
      <textarea id="reason-text" placeholder="Add reason…">${esc(c.comment)}</textarea>
      <div class="dialog__actions">
        <button class="btn btn--sf" style="background:var(--bg-subtle);color:var(--text-primary)"
                data-act="closeOverlay">Cancel</button>
        <button class="btn btn--sf" style="background:var(--bg-accent);color:var(--text-on-accent)"
                data-act="saveReason" data-arg="${folderId}:${personId}">Save</button>
      </div>
    </div>`;
  },

  share(what) {
    return `<div class="ios-alert">
      <div class="body">
        <h3>Share ${esc(what)}?</h3>
        <p>Шеринга по ссылке в прототипе нет — диалог для вида.</p>
      </div>
      <div class="actions">
        <button data-act="closeOverlay">No</button>
        <button data-act="closeOverlay">Yes</button>
      </div>
    </div>`;
  },
};

/* ============================ ДЕЙСТВИЯ ============================ */

const ACTIONS = {
  go: a => { closeOverlay(); go(a === 'back' ? backTarget() : a); },
  toast: a => showToast(a),
  closeOverlay,
  overlay: a => { ui.overlayArg = a.split(':'); ui.overlay = true; renderOverlay(); },

  signIn: () => { S.signIn(); go('folders'); },

  clearQ: a => { ui.q[a] = ''; render(); },

  addTag: () => {
    const input = $('#folder-tag');
    const v = input.value.trim().toUpperCase();
    ui.newName = $('#folder-name').value;
    if (v && !ui.newTags.includes(v)) ui.newTags.push(v);
    render();
  },
  dropTag: a => { ui.newName = $('#folder-name').value; ui.newTags.splice(+a, 1); render(); },
  createFolder: () => {
    const name = $('#folder-name').value.trim();
    if (!name) { showToast('Введи название папки'); return; }
    const f = S.createFolder(name, ui.newTags);
    ui.newName = ''; ui.newTags = [];
    go('f/' + f.id);
  },

  duplicateFolder: a => { closeOverlay(); const f = S.duplicateFolder(a); showToast('Копия создана'); go('f/' + f.id); },
  deleteFolder: a => { closeOverlay(); S.deleteFolder(a); showToast('Папка удалена'); go('folders'); },

  addPerson: a => {
    const [fid, pid] = a.split(':');
    S.addToRoster(fid, pid);
    showToast(`${D.byId.person[pid].name} → ${S.folder(fid).name}`);
  },
  addMovie: a => {
    const [fid, mid] = a.split(':');
    const n = S.addMovieToRoster(fid, mid);
    showToast(n ? `Добавлено ${n} чел. из «${D.byId.movie[mid].title}»` : 'Все уже в папке');
  },
  removePerson: a => {
    const [fid, pid] = a.split(':');
    closeOverlay(); S.removeFromRoster(fid, pid); showToast('Убрали из папки');
  },

  pick: a => {
    if (!S.state.folders.length) { showToast('Сначала создай папку'); go('folder-new'); return; }
    ui.sheetPicked = [];
    ui.overlayArg = ['select-folder', a]; ui.overlay = true; renderOverlay();
  },
  pickFolder: a => {
    const i = ui.sheetPicked.indexOf(a);
    if (i === -1) ui.sheetPicked.push(a); else ui.sheetPicked.splice(i, 1);
    renderOverlay();
  },
  confirmPick: a => {
    if (!ui.sheetPicked.length) return;
    ui.sheetPicked.forEach(fid => S.addToRoster(fid, a));
    const names = ui.sheetPicked.map(fid => S.folder(fid).name).join(', ');
    closeOverlay();
    showToast(`Добавлено в «${names}»`);
  },

  setRole: a => {
    const [fid, pid, where, role] = a.split(':');
    const r = decodeURIComponent(role);
    if (where === 'pack') S.setCandidate(fid, pid, { role: r });
    else S.setRosterRole(fid, pid, r);
    closeOverlay();
    showToast(r ? 'Роль: ' + r : 'Роль снята');
  },
  addRole: a => {
    const v = $('#role-new').value;
    if (!v.trim()) return;
    const r = S.addRole(v);
    ACTIONS.setRole(a + ':' + encodeURIComponent(r));
  },

  rosterDept: a => { const [fid, d] = a.split(':'); toggleFilter(ui.deptFilter, fid, d); },
  packDept: a => { const [fid, d] = a.split(':'); toggleFilter(ui.deptFilter, 'pack-' + fid, d); },
  movieDept: a => { ui.movieDept = ui.movieDept === a ? null : a; render(); },
  favDept: a => { ui.favDept = ui.favDept === a ? null : a; render(); },
  setSort: a => { ui.sort = ui.sort === a ? null : a; closeOverlay(); },

  toggleImport: () => { ui.packImport = ui.packImport === false; renderOverlay(); },
  toggleInvite: () => { ui.packInvite = !ui.packInvite; renderOverlay(); },
  startPack: a => {
    S.startPackaging(a, ui.packImport !== false, !!ui.packInvite);
    closeOverlay();
    go(`f/${a}/pack`);
    showToast('Паккейджинг запущен');
  },
  closePack: a => { closeOverlay(); S.setClosed(a, true); showToast('Только чтение'); },
  reopenPack: a => { S.setClosed(a, false); showToast('Открыт заново'); },
  focusGoal: () => { const g = $('#goal-text'); g.focus(); autoGrow(g); },
  importRoster: a => {
    const f = S.folder(a);
    let n = 0;
    f.roster.forEach(r => { if (S.addCandidate(a, r.personId)) n++; });
    showToast(n ? `Перенесено ${n} чел.` : 'Все уже в списке');
  },
  parkCand: a => {
    const [fid, pid] = a.split(':');
    const c = S.folder(fid).packaging.candidates.find(c => c.personId === pid);
    closeOverlay(); S.setCandidate(fid, pid, { parked: !c.parked });
  },
  removeCand: a => { const [fid, pid] = a.split(':'); closeOverlay(); S.removeCandidate(fid, pid); },
  saveReason: a => {
    const [fid, pid] = a.split(':');
    const text = $('#reason-text').value.trim();
    closeOverlay(); S.setCandidate(fid, pid, { comment: text });
  },

  toggleFav: a => { closeOverlay(); showToast(S.toggleFavorite(a) ? 'Added to Favorites' : 'Убрали из избранного'); },

  saveNote: a => {
    const [pid, nid] = a.split(':');
    const text = $('#note-text').value.trim();
    if (!text) { showToast('Заметка пустая'); return; }
    S.saveNote(pid, nid, text);
    go('notes/' + pid);
  },
  deleteNote: a => { const [pid, nid] = a.split(':'); S.deleteNote(pid, nid); },
};

function toggleFilter(bag, key, value) {
  bag[key] = bag[key] === value ? null : value;
  render();
}

function backTarget() {
  const r = route();
  if (r.name === 'person' || r.name === 'movie') return history.length > 1 ? 'back' : 'folders';
  return 'folders';
}

/* ============================ СЛУЖЕБНОЕ ============================ */

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
}

function groupBy(items, keyFn, sort) {
  const map = new Map();
  items.forEach(i => {
    const k = keyFn(i);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  });
  let groups = [...map.entries()];
  const SORTS = {
    'role-az': (a, b) => a[0].localeCompare(b[0]),
    'role-za': (a, b) => b[0].localeCompare(a[0]),
    'count-desc': (a, b) => b[1].length - a[1].length,
    'count-asc': (a, b) => a[1].length - b[1].length,
    'recent': (a, b) => Math.max(...b[1].map(i => i.addedAt || 0)) - Math.max(...a[1].map(i => i.addedAt || 0)),
  };
  if (sort && SORTS[sort]) groups.sort(SORTS[sort]);
  return groups;
}

function directorOf(m) {
  const d = m.crew.find(c => c[1] === 'DIRECTOR');
  return d ? titleCase(D.byId.person[d[0]].name) : '—';
}

let toastTimer;
function showToast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('is-open');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-open'), 2200);
}

function closeOverlay() { ui.overlay = null; renderOverlay(); }

function autoGrow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

/* ============================ РЕНДЕР ============================ */

function render() {
  if (!S.state.signedIn) { location.hash = ''; }
  const r = S.state.signedIn ? route() : { name: 'signin' };
  const name = r.name || 'folders';

  let html;
  if (name === 'f') html = SCREENS.f(r.a, r.b);
  else if (name === 'person') html = SCREENS.person(r.a);
  else if (name === 'movie') html = SCREENS.movie(r.a, r.b);
  else if (name === 'notes') html = SCREENS.notes(r.a);
  else if (name === 'note') html = SCREENS.note(r.a, r.b);
  else if (SCREENS[name]) html = SCREENS[name]();
  else html = SCREENS.folders();

  $('#app').innerHTML = `<section class="screen is-active">${html}</section>`;
  $('#clock').textContent = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

  renderNav();
  const goal = $('#goal-text');
  if (goal) autoGrow(goal);
}

function renderNav() {
  const box = $('#nav-folders');
  const list = S.state.folders;
  box.innerHTML = list.length
    ? list.map(f => `<a href="#f/${f.id}">${esc(f.name)}</a>`).join('')
    : '<p class="nav__none">пока ни одной</p>';
  const hash = location.hash;
  $$('.nav a').forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === hash));
}

/* ---------- события ---------- */

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  // вложенная кнопка не должна проваливаться в строку под ней
  const stop = e.target.closest('[data-stop]');
  const target = stop && btn.contains(stop) && stop !== btn ? stop.closest('[data-act]') : btn;
  const fn = ACTIONS[target.dataset.act];
  if (!fn) return;
  e.preventDefault();
  e.stopPropagation();
  fn(target.dataset.arg);
});

document.addEventListener('input', e => {
  const q = e.target.dataset.q;
  if (q !== undefined) {
    ui.q[q] = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const again = $(`[data-q="${q}"]`);
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id === 'goal-text') {
    autoGrow(e.target);
    S.state.folders.find(f => f.id === e.target.dataset.folder).packaging.goal = e.target.value;
    S.commit();
  }
});

/* экранная клавиатура печатает в сфокусированное поле */
document.addEventListener('mousedown', e => {
  const key = e.target.closest('.kb-key');
  if (!key) return;
  const input = document.activeElement;
  if (!input || !/^(INPUT|TEXTAREA)$/.test(input.tagName)) return;
  e.preventDefault();
  const label = key.textContent.trim();
  if (label === '⌫') input.value = input.value.slice(0, -1);
  else if (label === 'space') input.value += ' ';
  else if (label === 'return') input.value += '\n';
  else if (label === 'done') input.blur();
  else if (label.length === 1 && /[A-Z]/.test(label)) input.value += label;
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

/* перетаскивание кандидатов */
document.addEventListener('dragstart', e => {
  const h = e.target.closest('.drag-handle');
  if (!h) { e.preventDefault(); return; }
  ui.dragId = h.closest('[data-cand]').dataset.cand;
  e.dataTransfer.effectAllowed = 'move';
});

document.addEventListener('dragover', e => {
  if (!ui.dragId) return;
  e.preventDefault();
  const over = e.target.closest('[data-cand], [data-dept]');
  if (!over) return;
  $$('.drop-before').forEach(el => el.classList.remove('drop-before'));
  over.classList.add('drop-before');
});

document.addEventListener('drop', e => {
  if (!ui.dragId) return;
  e.preventDefault();
  const over = $('.drop-before');
  if (over) {
    const fid = route().a;
    if (over.dataset.dept) {
      // бросили на заголовок — кандидат уходит в этот департамент, первым
      const first = over.nextElementSibling?.dataset.cand;
      S.moveCandidate(fid, ui.dragId, first, over.dataset.dept);
    } else {
      const target = S.folder(fid).packaging.candidates.find(c => c.personId === over.dataset.cand);
      S.moveCandidate(fid, ui.dragId, over.dataset.cand, target.dept);
    }
  }
  ui.dragId = null;
});

document.addEventListener('dragend', () => {
  $$('.drop-before').forEach(el => el.classList.remove('drop-before'));
  ui.dragId = null;
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeOverlay();
});

$('#nav-reset').addEventListener('click', () => {
  S.reset();
  location.hash = '';
  render();
  showToast('Данные сброшены');
});

$('#nav-demo').addEventListener('click', () => {
  S.signIn();
  const f = S.createFolder('The Odyssey', ['ADVENTURE']);
  S.addMovieToRoster(f.id, 'odyssey');
  S.startPackaging(f.id, true, false);
  S.setGoal(f.id, 'Собрать актёрский состав до 15 ноября');
  go('f/' + f.id);
  showToast('Пример залит');
});

S.onChange(render);
window.addEventListener('hashchange', () => { closeOverlay(); render(); });
render();
