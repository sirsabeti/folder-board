/* ---------- elements ---------- */
const tabsEl = document.getElementById('tabs');
const addPageBtn = document.getElementById('addPageBtn');
const board = document.getElementById('board');
const wallpaperLayer = document.getElementById('wallpaperLayer');
const searchInput = document.getElementById('searchInput');
const searchToggle = document.getElementById('searchToggle');
const expandBtn = document.getElementById('expandBtn'); // popup only

const wallpaperFab = document.getElementById('wallpaperFab');
const wallpaperPopover = document.getElementById('wallpaperPopover');
const uploadWallpaperBtn = document.getElementById('uploadWallpaperBtn');
const wallpaperFile = document.getElementById('wallpaperFile');

const themeToggle = document.getElementById('themeToggle');
const importBtn = document.getElementById('importBtn');
const remindersBtn = document.getElementById('remindersBtn');
const calendarBtn = document.getElementById('calendarBtn');
const clockTime = document.getElementById('clockTime');
const clockDate = document.getElementById('clockDate');
const hideToggle = document.getElementById('hideToggle');
const incognitoBtn = document.getElementById('incognitoBtn');
const exportBtn = document.getElementById('exportBtn');

const settingsBtn = document.getElementById('settingsBtn');
const settingsPopover = document.getElementById('settingsPopover');
const railToggle = document.getElementById('railToggle');
const rail = document.getElementById('rail');
const openStylePanelBtn = document.getElementById('openStylePanelBtn');
const styleBackdrop = document.getElementById('styleBackdrop');
const styleSub = document.getElementById('styleSub');
const styleAccentColor = document.getElementById('styleAccentColor');
const styleAccentHex = document.getElementById('styleAccentHex');
const styleBoardColor = document.getElementById('styleBoardColor');
const styleBoardHex = document.getElementById('styleBoardHex');
const styleIconColor = document.getElementById('styleIconColor');
const styleIconHex = document.getElementById('styleIconHex');
const styleTextColor = document.getElementById('styleTextColor');
const styleTextHex = document.getElementById('styleTextHex');
const styleOpacity = document.getElementById('styleOpacity');
const styleOpacityVal = document.getElementById('styleOpacityVal');
const styleBlur = document.getElementById('styleBlur');
const styleBlurVal = document.getElementById('styleBlurVal');
const styleReset = document.getElementById('styleReset');
const styleCancel = document.getElementById('styleCancel');
const styleSave = document.getElementById('styleSave');
const settingFontFamily = document.getElementById('settingFontFamily');
const settingFontScale = document.getElementById('settingFontScale');
const settingCompact = document.getElementById('settingCompact');
const settingFavicons = document.getElementById('settingFavicons');
const settingEdit = document.getElementById('settingEdit');
const settingDesc = document.getElementById('settingDesc');
const settingAutoHide = document.getElementById('settingAutoHide');
const settingAutoHideCount = document.getElementById('settingAutoHideCount');
const openManagerBtn = document.getElementById('openManagerBtn');

const modalBackdrop = document.getElementById('modalBackdrop');
const modalHeading = document.getElementById('modalHeading');
const titleLabel = document.getElementById('titleLabel');
const urlField = document.getElementById('urlField');
const bmTitle = document.getElementById('bmTitle');
const bmUrl = document.getElementById('bmUrl');
const confirmAdd = document.getElementById('confirmAdd');
const cancelAdd = document.getElementById('cancelAdd');

const boardMenu = document.getElementById('boardMenu');
const menuMaximize = document.getElementById('menuMaximize');
const menuLink = document.getElementById('menuLink');
const menuRename = document.getElementById('menuRename');
const menuDelete = document.getElementById('menuDelete');

/* ---------- state ---------- */
const STORAGE_KEY = 'fb_state';
let state = {
  theme: 'dark',
  accentColor: '#34d399',
  boardColor: '#ffffff',
  boardOpacity: 14,
  boardBlur: 28,
  iconColor: '#9ea8b0',
  textColor: '#ffffff',
  railCollapsed: false,
  wallpaper: 'forest',
  customWallpaperDataUrl: null,
  showFavicons: true,
  compact: false,
  editMode: false,
  showDesc: false,
  autoHide: false,
  autoHideCount: 8,
  blurred: false,
  fontFamily: 'system',
  fontScale: 1,
  boardLinks: {},        // { boardFolderId: 'https://...' }
  pageIds: null,        // [rootFolderId, ...customPageFolderIds]
  pageLabels: {},        // { folderId: 'Display name' }
  activePageId: null,
  columnOrders: {}       // { pageId: [boardFolderId, ...] }
};

let maximizedColId = null;

let tree = null;
let otherBookmarksId = null; // where new custom pages get created
let currentBoards = [];      // cache for the active page, so we can re-render without refetching
const expandedCols = new Set();
let modalMode = 'bookmark';  // 'page' | 'board' | 'bookmark'
let modalTargetId = null;    // parentId for board/bookmark creation

const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
function applyRTL(el) {
  if (RTL_RE.test(el.textContent)) {
    el.classList.add('rtl-text');
    el.dir = 'rtl';
  }
}

function loadState(cb) {
  chrome.storage.local.get(STORAGE_KEY, (res) => {
    if (res && res[STORAGE_KEY]) state = Object.assign({}, state, res[STORAGE_KEY]);
    cb();
  });
}
function saveState() { chrome.storage.local.set({ [STORAGE_KEY]: state }); }

/* ---------- favicons ---------- */
function faviconUrl(pageUrl) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '32');
  return url.toString();
}
function isFolder(node) { return !node.url; }

/* ---------- tree lookup helpers ---------- */
function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/* ---------- pages ---------- */
function ensurePagesInitialized(rootNode) {
  const rootFolders = rootNode.children || []; // Bookmarks Bar, Other Bookmarks, Mobile Bookmarks
  if (!state.pageIds) {
    state.pageIds = rootFolders.map(f => f.id);
    state.pageLabels = {};
    if (rootFolders[0]) state.pageLabels[rootFolders[0].id] = 'Home';
    state.activePageId = rootFolders[0] ? rootFolders[0].id : null;
  }
  // keep only pages that still exist
  const allIds = new Set();
  (function collect(n) { allIds.add(n.id); (n.children || []).forEach(collect); })(rootNode);
  state.pageIds = state.pageIds.filter(id => allIds.has(id));
  if (!state.activePageId || !state.pageIds.includes(state.activePageId)) {
    state.activePageId = state.pageIds[0] || null;
  }
  otherBookmarksId = rootFolders[1] ? rootFolders[1].id : (rootFolders[0] ? rootFolders[0].id : null);
}

function pageLabel(id, node) {
  return state.pageLabels[id] || (node ? node.title : 'Untitled') || 'Untitled';
}

function renderTabs() {
  tabsEl.innerHTML = '';
  state.pageIds.forEach(id => {
    const node = findNode(tree, id);
    const label = pageLabel(id, node);
    const tab = document.createElement('button');
    tab.className = 'tab' + (id === state.activePageId ? ' active' : '');
    tab.textContent = label;
    applyRTL(tab);
    tab.addEventListener('click', () => {
      state.activePageId = id;
      saveState();
      renderTabs();
      loadActivePage();
    });
    tabsEl.appendChild(tab);
  });
}

/* ---------- boards for the active page ---------- */
function boardsForPage(pageNode) {
  const boards = [];
  const directBookmarks = (pageNode.children || []).filter(c => !isFolder(c));
  if (directBookmarks.length > 0) {
    boards.push({ id: pageNode.id, title: pageNode.title || 'Untitled', bookmarks: directBookmarks });
  }
  function walk(node) {
    (node.children || []).forEach(child => {
      if (isFolder(child) && !state.pageIds.includes(child.id)) {
        boards.push({
          id: child.id,
          title: child.title || 'Untitled',
          bookmarks: (child.children || []).filter(c => !isFolder(c))
        });
        walk(child);
      }
    });
  }
  walk(pageNode);
  return boards;
}

function mergeColumnOrder(pageId, boards) {
  const ids = boards.map(b => b.id);
  let order = (state.columnOrders[pageId] || []).filter(id => ids.includes(id));
  ids.forEach(id => { if (!order.includes(id)) order.push(id); });
  state.columnOrders[pageId] = order;
  return order;
}

/* ---------- render board ---------- */
function renderBoard(boards) {
  currentBoards = boards;
  const pageId = state.activePageId;
  const order = mergeColumnOrder(pageId, boards);
  const byId = {};
  boards.forEach(b => byId[b.id] = b);

  board.innerHTML = '';
  order.forEach(id => {
    const b = byId[id];
    if (b) board.appendChild(renderColumn(b));
  });
  board.appendChild(renderAddBoardCard());
  saveState();
  applySearch();
}

function renderAddBoardCard() {
  const card = document.createElement('button');
  card.className = 'add-board-card';
  card.innerHTML = '<span><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add board</span>';
  card.addEventListener('click', () => openModal('board', state.activePageId));
  return card;
}

function renderColumn(folder) {
  const col = document.createElement('div');
  col.className = 'col' + (folder.id === maximizedColId ? ' maximized' : '');
  col.dataset.id = folder.id;

  const titleBar = document.createElement('div');
  titleBar.className = 'col-title';
  titleBar.draggable = true;

  const grip = document.createElement('span');
  grip.className = 'grip';
  grip.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.4"/><circle cx="8" cy="12" r="1.4"/><circle cx="8" cy="18" r="1.4"/><circle cx="16" cy="6" r="1.4"/><circle cx="16" cy="12" r="1.4"/><circle cx="16" cy="18" r="1.4"/></svg>';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  nameSpan.textContent = folder.title;
  applyRTL(nameSpan);
  const boardLink = state.boardLinks[folder.id];
  if (boardLink) {
    nameSpan.classList.add('has-link');
    nameSpan.title = boardLink;
    nameSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = boardLink;
    });
  }

  const countSpan = document.createElement('span');
  countSpan.className = 'count';
  countSpan.textContent = folder.bookmarks.length;

  const menuBtn = document.createElement('button');
  menuBtn.className = 'col-action';
  menuBtn.title = 'Board options';
  menuBtn.draggable = false;
  menuBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openBoardMenu(folder, col, menuBtn);
  });

  titleBar.appendChild(grip);
  titleBar.appendChild(nameSpan);
  titleBar.appendChild(countSpan);
  titleBar.appendChild(menuBtn);
  col.appendChild(titleBar);

  const total = folder.bookmarks.length;
  const expanded = expandedCols.has(folder.id);
  const limit = (state.autoHide && !expanded) ? state.autoHideCount : total;

  if (total === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No bookmarks here';
    col.appendChild(empty);
  } else {
    folder.bookmarks.slice(0, limit).forEach(b => col.appendChild(renderRow(b)));
    if (state.autoHide && total > state.autoHideCount) {
      const moreBtn = document.createElement('button');
      moreBtn.className = 'show-more-btn';
      moreBtn.textContent = expanded ? 'Show less' : `Show ${total - state.autoHideCount} more`;
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (expanded) expandedCols.delete(folder.id); else expandedCols.add(folder.id);
        renderBoard(currentBoards);
      });
      col.appendChild(moreBtn);
    }
  }

  const addRow = document.createElement('button');
  addRow.className = 'add-bookmark-row';
  addRow.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Add bookmark</span>';
  addRow.addEventListener('click', (e) => { e.stopPropagation(); openModal('bookmark', folder.id); });
  col.appendChild(addRow);

  /* drag: reorder this board */
  titleBar.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('application/x-col-id', folder.id);
    e.dataTransfer.effectAllowed = 'move';
    col.classList.add('dragging');
  });
  titleBar.addEventListener('dragend', () => col.classList.remove('dragging'));

  col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
  col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
  col.addEventListener('drop', (e) => {
    e.preventDefault();
    col.classList.remove('drag-over');
    const types = Array.from(e.dataTransfer.types || []);

    if (types.includes('application/x-col-id')) {
      const draggedId = e.dataTransfer.getData('application/x-col-id');
      if (draggedId && draggedId !== folder.id) reorderColumns(draggedId, folder.id);
      return;
    }

    let url = e.dataTransfer.getData('text/uri-list');
    if (!url) url = extractHrefFromHtml(e.dataTransfer.getData('text/html'));
    if (!url) url = e.dataTransfer.getData('text/plain');
    url = (url || '').trim().split('\n')[0].trim();

    if (url && /^https?:\/\//i.test(url)) {
      const title = guessTitleFromDrop(e.dataTransfer, url);
      chrome.bookmarks.create({ parentId: folder.id, title, url }, loadActivePage);
    }
  });

  return col;
}

function renderRow(node) {
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.id = node.id;
  row.dataset.title = (node.title || '').toLowerCase();
  row.dataset.url = (node.url || '').toLowerCase();

  const icon = document.createElement('img');
  icon.className = 'favicon';
  icon.src = faviconUrl(node.url);
  icon.alt = '';

  const textWrap = document.createElement('div');
  textWrap.className = 'row-text';

  const label = document.createElement('span');
  label.className = 'row-title';
  label.textContent = node.title || node.url;
  applyRTL(label);

  const desc = document.createElement('span');
  desc.className = 'row-desc';
  desc.textContent = node.url || '';

  textWrap.appendChild(label);
  textWrap.appendChild(desc);

  const del = document.createElement('button');
  del.className = 'row-delete';
  del.title = 'Remove bookmark';
  del.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Remove "${node.title}"?`)) chrome.bookmarks.remove(node.id, loadActivePage);
  });

  row.appendChild(icon);
  row.appendChild(textWrap);
  row.appendChild(del);

  row.addEventListener('click', () => {
    if (board.classList.contains('edit-mode')) return;
    if (node.url) window.location.href = node.url;
  });

  return row;
}

/* ---------- board menu (maximize / link / rename / delete) ---------- */
let boardMenuTarget = null; // folder object currently targeted by the menu

function openBoardMenu(folder, colEl, btn) {
  boardMenuTarget = folder;
  const isMax = folder.id === maximizedColId;
  menuMaximize.textContent = isMax ? 'Restore board' : 'Maximize board';
  menuLink.textContent = state.boardLinks[folder.id] ? 'Edit link…' : 'Add link…';

  const rect = btn.getBoundingClientRect();
  boardMenu.style.top = (rect.bottom + 6) + 'px';
  boardMenu.style.left = Math.max(8, rect.right - 150) + 'px';
  closeAllPopovers();
  boardMenu.classList.add('visible');
}
function closeBoardMenu() { boardMenu.classList.remove('visible'); }

menuMaximize.addEventListener('click', () => {
  if (!boardMenuTarget) return;
  maximizedColId = (maximizedColId === boardMenuTarget.id) ? null : boardMenuTarget.id;
  closeBoardMenu();
  renderBoard(currentBoards);
});
menuLink.addEventListener('click', () => {
  if (!boardMenuTarget) return;
  const current = state.boardLinks[boardMenuTarget.id] || '';
  const url = prompt('Link for this board (leave blank to remove):', current);
  closeBoardMenu();
  if (url === null) return;
  const trimmed = url.trim();
  if (!trimmed) delete state.boardLinks[boardMenuTarget.id];
  else state.boardLinks[boardMenuTarget.id] = /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
  saveState();
  renderBoard(currentBoards);
});
menuRename.addEventListener('click', () => {
  if (!boardMenuTarget) return;
  const name = prompt('Board name:', boardMenuTarget.title);
  closeBoardMenu();
  if (!name || !name.trim()) return;
  chrome.bookmarks.update(boardMenuTarget.id, { title: name.trim() }, loadActivePage);
});
menuDelete.addEventListener('click', () => {
  if (!boardMenuTarget) return;
  closeBoardMenu();
  if (confirm(`Delete board "${boardMenuTarget.title}" and everything in it?`)) {
    chrome.bookmarks.removeTree(boardMenuTarget.id, () => {
      if (maximizedColId === boardMenuTarget.id) maximizedColId = null;
      loadActivePage();
    });
  }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.board-menu') && !e.target.closest('.col-action')) closeBoardMenu();
});

/* ---------- reorder ---------- */
function reorderColumns(draggedId, targetId) {
  const pageId = state.activePageId;
  const order = (state.columnOrders[pageId] || []).slice();
  const from = order.indexOf(draggedId);
  if (from < 0) return;
  order.splice(from, 1);
  const to = order.indexOf(targetId);
  order.splice(to < 0 ? order.length : to, 0, draggedId);
  state.columnOrders[pageId] = order;
  saveState();
  renderBoard(currentBoards);
}

/* ---------- drop helpers ---------- */
function extractHrefFromHtml(html) {
  if (!html) return null;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const a = doc.querySelector('a[href]');
    return a ? a.getAttribute('href') : null;
  } catch (e) { return null; }
}
function guessTitleFromDrop(dt, url) {
  const html = dt.getData('text/html');
  if (html) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const a = doc.querySelector('a[href]');
      if (a && a.textContent.trim()) return a.textContent.trim();
    } catch (e) {}
  }
  const plain = dt.getData('text/plain');
  if (plain && plain.trim() && !/^https?:\/\//i.test(plain.trim())) return plain.trim();
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
}

/* ---------- load ---------- */
function loadBookmarks() {
  chrome.bookmarks.getTree((nodes) => {
    tree = nodes;
    ensurePagesInitialized(nodes[0]);
    renderTabs();
    loadActivePage();
  });
}
function loadActivePage() {
  const pageNode = findNode(tree, state.activePageId);
  if (!pageNode) { board.innerHTML = ''; board.appendChild(renderAddBoardCard()); return; }
  renderBoard(boardsForPage(pageNode));
}

/* ---------- search ---------- */
searchToggle.addEventListener('click', () => {
  searchInput.classList.toggle('visible');
  if (searchInput.classList.contains('visible')) searchInput.focus();
  else { searchInput.value = ''; applySearch(); }
});
searchInput.addEventListener('input', applySearch);

function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  const rows = board.querySelectorAll('.row');
  rows.forEach(row => {
    const match = !q || row.dataset.title.includes(q) || row.dataset.url.includes(q);
    row.style.display = match ? '' : 'none';
  });
  const cols = board.querySelectorAll('.col');
  cols.forEach(col => {
    const rowsInCol = col.querySelectorAll('.row');
    const anyVisible = Array.from(rowsInCol).some(r => r.style.display !== 'none');
    col.style.display = (!q || anyVisible || rowsInCol.length === 0) ? '' : 'none';
  });
}

/* ---------- popovers ---------- */
function closeAllPopovers() { document.querySelectorAll('.popover').forEach(p => p.classList.remove('visible')); }
function positionPopover(pop, btn) {
  const bodyRow = document.querySelector('.body-row');
  const bodyRect = bodyRow.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  if (btn === wallpaperFab) {
    pop.style.top = 'auto';
    pop.style.right = 'auto';
    pop.style.left = (btnRect.right - bodyRect.left + 10) + 'px';
    pop.style.bottom = (bodyRect.bottom - btnRect.bottom) + 'px';
  } else {
    pop.style.left = 'auto';
    pop.style.bottom = 'auto';
    pop.style.top = Math.max(8, btnRect.top - bodyRect.top) + 'px';
    pop.style.right = '66px';
  }
}
function togglePopover(pop, btn) {
  const wasVisible = pop.classList.contains('visible');
  closeAllPopovers();
  if (!wasVisible) { positionPopover(pop, btn); pop.classList.add('visible'); }
}
document.addEventListener('click', (e) => {
  if (e.target.closest('.popover') || wallpaperFab.contains(e.target) || settingsBtn.contains(e.target)) return;
  closeAllPopovers();
});

/* ---------- wallpaper ---------- */
const WALLPAPER_NAMES = ['forest', 'sunset-peaks', 'desert-dusk', 'ocean-night', 'aurora', 'mono'];
function applyWallpaper() {
  let imageUrl;
  if (state.wallpaper === 'custom' && state.customWallpaperDataUrl) {
    imageUrl = state.customWallpaperDataUrl;
  } else {
    const name = WALLPAPER_NAMES.includes(state.wallpaper) ? state.wallpaper : 'forest';
    imageUrl = chrome.runtime.getURL(`wallpapers/bg-${name}.svg`);
  }
  wallpaperLayer.style.backgroundImage = `url("${imageUrl}")`;
  wallpaperLayer.style.backgroundSize = 'cover';
  wallpaperLayer.style.backgroundPosition = 'center';
  wallpaperLayer.style.backgroundRepeat = 'no-repeat';
  document.querySelectorAll('.wallpaper-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.wallpaper === state.wallpaper);
  });
}
document.querySelectorAll('.wallpaper-swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    state.wallpaper = sw.dataset.wallpaper;
    state.customWallpaperDataUrl = null;
    applyWallpaper();
    saveState();
    closeAllPopovers();
    openStylePanel();
  });
});
uploadWallpaperBtn.addEventListener('click', () => wallpaperFile.click());
wallpaperFile.addEventListener('change', () => {
  const file = wallpaperFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.wallpaper = 'custom';
    state.customWallpaperDataUrl = reader.result;
    applyWallpaper();
    saveState();
    closeAllPopovers();
    openStylePanel();
  };
  reader.readAsDataURL(file);
});

/* ---------- clock ---------- */
function updateClock() {
  const now = new Date();
  clockTime.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  clockDate.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
updateClock();
setInterval(updateClock, 30000);

/* ---------- calendar / reminders ---------- */
calendarBtn.addEventListener('click', () => chrome.tabs.create({ url: 'https://calendar.google.com/' }));
remindersBtn.addEventListener('click', () => chrome.tabs.create({ url: 'https://www.icloud.com/reminders/' }));

/* ---------- theme ---------- */
function applyTheme() { document.body.classList.toggle('light', state.theme === 'light'); }
themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  saveState();
});

/* ---------- color helpers ---------- */
function hexToRgb(hex) {
  const m = (hex || '#34d399').replace('#', '').match(/.{1,2}/g) || ['34', 'd3', '99'];
  return m.map(h => parseInt(h, 16));
}
function shade(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const adj = (c) => Math.max(0, Math.min(255, Math.round(c + amount)));
  return `#${[adj(r), adj(g), adj(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}
function isValidHex(v) { return /^#?[0-9a-fA-F]{6}$/.test(v); }
function normalizeHex(v) { return v.startsWith('#') ? v : '#' + v; }

/* ---------- apply accent + board style from state ---------- */
function applyAccentColor() {
  const hex = state.accentColor || '#34d399';
  const [r, g, b] = hexToRgb(hex);
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-strong', shade(hex, -30));
  document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.16)`);
}
function applyBoardStyle() {
  const hex = state.boardColor || '#ffffff';
  const [r, g, b] = hexToRgb(hex);
  const a1 = (state.boardOpacity ?? 14) / 100;          // main glass alpha
  const a2 = a1 * 0.32;                                  // secondary gradient stop
  const aBorder = Math.min(1, a1 * 1.4 + 0.05);
  const aChip = Math.max(a1 * 0.55, 0.1);                // chip backgrounds never fall below a visible floor
  document.documentElement.style.setProperty('--panel-glass-1', `rgba(${r},${g},${b},${a1.toFixed(3)})`);
  document.documentElement.style.setProperty('--panel-glass-2', `rgba(${r},${g},${b},${a2.toFixed(3)})`);
  document.documentElement.style.setProperty('--panel-border', `rgba(${r},${g},${b},${aBorder.toFixed(3)})`);
  document.documentElement.style.setProperty('--panel-blur', `${state.boardBlur ?? 28}px`);
  document.documentElement.style.setProperty('--chip-bg', `rgba(${r},${g},${b},${aChip.toFixed(3)})`);
  document.documentElement.style.setProperty('--chip-bg-hover', `rgba(${r},${g},${b},${Math.min(1, aChip * 1.8).toFixed(3)})`);
}
function applyIconColor() {
  document.body.style.setProperty('--text-muted', state.iconColor || '#9ea8b0');
}
function applyTextColor() {
  document.body.style.setProperty('--text', state.textColor || '#ffffff');
  document.body.style.setProperty('--text-heading', state.textColor || '#ffffff');
}

/* ---------- Adjust Wallpaper Style panel ---------- */
let styleSnapshot = null;

function populateStylePanel() {
  styleSub.textContent = (state.theme === 'light' ? 'Light' : 'Dark') + ' theme on this device.';
  styleAccentColor.value = state.accentColor;
  styleAccentHex.value = state.accentColor.toUpperCase();
  styleBoardColor.value = state.boardColor;
  styleBoardHex.value = state.boardColor.toUpperCase();
  styleIconColor.value = state.iconColor;
  styleIconHex.value = state.iconColor.toUpperCase();
  styleTextColor.value = state.textColor;
  styleTextHex.value = state.textColor.toUpperCase();
  styleOpacity.value = state.boardOpacity;
  styleOpacityVal.textContent = state.boardOpacity + '%';
  styleBlur.value = state.boardBlur;
  styleBlurVal.textContent = state.boardBlur + 'px';
}
function openStylePanel() {
  styleSnapshot = {
    accentColor: state.accentColor,
    boardColor: state.boardColor,
    boardOpacity: state.boardOpacity,
    boardBlur: state.boardBlur,
    iconColor: state.iconColor,
    textColor: state.textColor
  };
  populateStylePanel();
  closeAllPopovers();
  styleBackdrop.classList.add('visible');
}
function closeStylePanel() { styleBackdrop.classList.remove('visible'); }

wallpaperFab.addEventListener('click', () => togglePopover(wallpaperPopover, wallpaperFab));
openStylePanelBtn.addEventListener('click', openStylePanel);

styleAccentColor.addEventListener('input', () => {
  state.accentColor = styleAccentColor.value;
  styleAccentHex.value = state.accentColor.toUpperCase();
  applyAccentColor();
  saveState();
});
styleAccentHex.addEventListener('change', () => {
  if (!isValidHex(styleAccentHex.value)) { styleAccentHex.value = state.accentColor.toUpperCase(); return; }
  state.accentColor = normalizeHex(styleAccentHex.value);
  styleAccentColor.value = state.accentColor;
  applyAccentColor();
  saveState();
});
styleBoardColor.addEventListener('input', () => {
  state.boardColor = styleBoardColor.value;
  styleBoardHex.value = state.boardColor.toUpperCase();
  applyBoardStyle();
  saveState();
});
styleBoardHex.addEventListener('change', () => {
  if (!isValidHex(styleBoardHex.value)) { styleBoardHex.value = state.boardColor.toUpperCase(); return; }
  state.boardColor = normalizeHex(styleBoardHex.value);
  styleBoardColor.value = state.boardColor;
  applyBoardStyle();
  saveState();
});
styleIconColor.addEventListener('input', () => {
  state.iconColor = styleIconColor.value;
  styleIconHex.value = state.iconColor.toUpperCase();
  applyIconColor();
  saveState();
});
styleIconHex.addEventListener('change', () => {
  if (!isValidHex(styleIconHex.value)) { styleIconHex.value = state.iconColor.toUpperCase(); return; }
  state.iconColor = normalizeHex(styleIconHex.value);
  styleIconColor.value = state.iconColor;
  applyIconColor();
  saveState();
});
styleTextColor.addEventListener('input', () => {
  state.textColor = styleTextColor.value;
  styleTextHex.value = state.textColor.toUpperCase();
  applyTextColor();
  saveState();
});
styleTextHex.addEventListener('change', () => {
  if (!isValidHex(styleTextHex.value)) { styleTextHex.value = state.textColor.toUpperCase(); return; }
  state.textColor = normalizeHex(styleTextHex.value);
  styleTextColor.value = state.textColor;
  applyTextColor();
  saveState();
});
styleOpacity.addEventListener('input', () => {
  state.boardOpacity = parseInt(styleOpacity.value, 10);
  styleOpacityVal.textContent = state.boardOpacity + '%';
  applyBoardStyle();
  saveState();
});
styleBlur.addEventListener('input', () => {
  state.boardBlur = parseInt(styleBlur.value, 10);
  styleBlurVal.textContent = state.boardBlur + 'px';
  applyBoardStyle();
  saveState();
});

styleCancel.addEventListener('click', () => {
  if (styleSnapshot) {
    Object.assign(state, styleSnapshot);
    applyAccentColor();
    applyBoardStyle();
    applyIconColor();
    applyTextColor();
    saveState();
  }
  closeStylePanel();
});
styleReset.addEventListener('click', () => {
  state.accentColor = '#34d399';
  state.boardColor = '#ffffff';
  state.boardOpacity = 14;
  state.boardBlur = 28;
  state.iconColor = '#9ea8b0';
  state.textColor = '#ffffff';
  applyAccentColor();
  applyBoardStyle();
  applyIconColor();
  applyTextColor();
  populateStylePanel();
  saveState();
});
styleSave.addEventListener('click', () => { saveState(); closeStylePanel(); });
styleBackdrop.addEventListener('click', (e) => { if (e.target === styleBackdrop) styleCancel.click(); });

/* ---------- rail collapse ---------- */
railToggle.addEventListener('click', () => {
  state.railCollapsed = !state.railCollapsed;
  rail.classList.toggle('collapsed', state.railCollapsed);
  saveState();
});


/* ---------- font family / size ---------- */
const FONT_STACKS = {
  system: {
    display: '-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif',
    text: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif'
  },
  iransans: {
    display: '"Iranian Sans","SF Pro Display",Arial,sans-serif',
    text: '"Iranian Sans","SF Pro Text",Arial,sans-serif'
  },
  serif: {
    display: 'Georgia,"Times New Roman",serif',
    text: 'Georgia,"Times New Roman",serif'
  },
  mono: {
    display: '"SFMono-Regular",Menlo,Consolas,monospace',
    text: '"SFMono-Regular",Menlo,Consolas,monospace'
  }
};
function applyFontFamily() {
  const stack = FONT_STACKS[state.fontFamily] || FONT_STACKS.system;
  document.documentElement.style.setProperty('--font-display', stack.display);
  document.documentElement.style.setProperty('--font-text', stack.text);
  settingFontFamily.value = state.fontFamily;
}
function applyFontScale() {
  document.querySelector('.app').style.zoom = state.fontScale;
  settingFontScale.value = state.fontScale;
}
settingFontFamily.addEventListener('change', () => {
  state.fontFamily = settingFontFamily.value;
  applyFontFamily();
  saveState();
});
settingFontScale.addEventListener('input', () => {
  state.fontScale = parseFloat(settingFontScale.value);
  applyFontScale();
  saveState();
});

/* ---------- import ---------- */
importBtn.addEventListener('click', () => chrome.tabs.create({ url: 'chrome://settings/importData' }));

/* ---------- hide / blur ---------- */
hideToggle.addEventListener('click', () => {
  state.blurred = !state.blurred;
  board.classList.toggle('blurred', state.blurred);
  hideToggle.classList.toggle('active', state.blurred);
  saveState();
});

/* ---------- incognito ---------- */
incognitoBtn.addEventListener('click', () => {
  chrome.windows.create({ url: 'chrome://newtab', incognito: true }, () => {
    if (chrome.runtime.lastError) {
      alert('Incognito windows are blocked for this browser profile. Enable "Allow in Incognito" for this extension, or check with your browser admin.');
    }
  });
});

/* ---------- export ---------- */
exportBtn.addEventListener('click', () => {
  chrome.bookmarks.getTree((nodes) => {
    const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bookmarks-export.json'; a.click();
    URL.revokeObjectURL(url);
  });
});

/* ---------- settings ---------- */
settingsBtn.addEventListener('click', () => togglePopover(settingsPopover, settingsBtn));
settingCompact.addEventListener('change', () => { state.compact = settingCompact.checked; board.classList.toggle('compact', state.compact); saveState(); });
settingFavicons.addEventListener('change', () => { state.showFavicons = settingFavicons.checked; board.classList.toggle('no-favicons', !state.showFavicons); saveState(); });
settingEdit.addEventListener('change', () => { state.editMode = settingEdit.checked; board.classList.toggle('edit-mode', state.editMode); saveState(); });
settingDesc.addEventListener('change', () => { state.showDesc = settingDesc.checked; board.classList.toggle('show-desc', state.showDesc); saveState(); });
settingAutoHide.addEventListener('change', () => { state.autoHide = settingAutoHide.checked; saveState(); renderBoard(currentBoards); });
settingAutoHideCount.addEventListener('change', () => {
  const v = parseInt(settingAutoHideCount.value, 10);
  state.autoHideCount = isNaN(v) ? 8 : Math.max(3, v);
  saveState();
  if (state.autoHide) renderBoard(currentBoards);
});
openManagerBtn.addEventListener('click', () => chrome.tabs.create({ url: 'chrome://bookmarks/' }));

/* ---------- popup expand ---------- */
if (expandBtn) {
  expandBtn.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') }));
}

/* ---------- add page / board / bookmark ---------- */
addPageBtn.addEventListener('click', () => openModal('page', otherBookmarksId));

function openModal(mode, targetId) {
  modalMode = mode;
  modalTargetId = targetId;
  bmTitle.value = '';
  bmUrl.value = '';
  if (mode === 'page') {
    modalHeading.textContent = 'Add page';
    titleLabel.textContent = 'Page name';
    bmTitle.placeholder = 'e.g. Work';
    urlField.style.display = 'none';
  } else if (mode === 'board') {
    modalHeading.textContent = 'Add board';
    titleLabel.textContent = 'Board name';
    bmTitle.placeholder = 'e.g. Design tools';
    urlField.style.display = 'none';
  } else {
    modalHeading.textContent = 'Add bookmark';
    titleLabel.textContent = 'Title';
    bmTitle.placeholder = 'Site name';
    urlField.style.display = 'block';
  }
  modalBackdrop.classList.add('visible');
  bmTitle.focus();
}
cancelAdd.addEventListener('click', () => modalBackdrop.classList.remove('visible'));
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) modalBackdrop.classList.remove('visible'); });

confirmAdd.addEventListener('click', () => {
  const title = bmTitle.value.trim();
  if (!title) return;

  if (modalMode === 'page') {
    chrome.bookmarks.create({ parentId: modalTargetId, title }, (folder) => {
      state.pageIds.push(folder.id);
      state.activePageId = folder.id;
      modalBackdrop.classList.remove('visible');
      loadBookmarks();
    });
    return;
  }

  if (modalMode === 'board') {
    chrome.bookmarks.create({ parentId: modalTargetId, title }, () => {
      modalBackdrop.classList.remove('visible');
      loadActivePage();
    });
    return;
  }

  let url = bmUrl.value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  chrome.bookmarks.create({ parentId: modalTargetId, title, url }, () => {
    modalBackdrop.classList.remove('visible');
    loadActivePage();
  });
});

/* ---------- live updates ---------- */
chrome.bookmarks.onCreated.addListener(loadBookmarks);
chrome.bookmarks.onRemoved.addListener(loadBookmarks);
chrome.bookmarks.onChanged.addListener(loadBookmarks);
chrome.bookmarks.onMoved.addListener(loadBookmarks);

/* ---------- init ---------- */
loadState(() => {
  applyTheme();
  applyAccentColor();
  applyBoardStyle();
  applyIconColor();
  applyTextColor();
  applyFontFamily();
  applyFontScale();
  applyWallpaper();
  rail.classList.toggle('collapsed', state.railCollapsed);
  board.classList.toggle('compact', state.compact);
  board.classList.toggle('no-favicons', !state.showFavicons);
  board.classList.toggle('edit-mode', state.editMode);
  board.classList.toggle('show-desc', state.showDesc);
  board.classList.toggle('blurred', state.blurred);
  hideToggle.classList.toggle('active', state.blurred);
  settingCompact.checked = state.compact;
  settingFavicons.checked = state.showFavicons;
  settingEdit.checked = state.editMode;
  settingDesc.checked = state.showDesc;
  settingAutoHide.checked = state.autoHide;
  settingAutoHideCount.value = state.autoHideCount;
  loadBookmarks();
});
