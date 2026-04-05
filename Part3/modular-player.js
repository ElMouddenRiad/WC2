import './components/playercontrols.js';
import './components/myequalizer.js';
import './components/myvisualizer.js';
import './components/wamplugin.js';
import './components/playlist.js';

const WAM_DEFAULT =
  'https://www.webaudiomodules.com/community/plugins/wimmics/graphicEqualizer/index.js';

const DEFAULT_TRACKS = [
  { src: './assets/Kalimba.mp3', title: 'Kalimba' },
  { src: './assets/Boney M. - Sunny (Official Audio).mp3', title: 'Boney M. - Sunny' },
  { src: './assets/Chic ~ I Want Your Love 1978 Disco Purrfection Version.mp3', title: 'Chic - I Want Your Love' },
  { src: './assets/Dire Straits - Tunnel Of Love.mp3', title: 'Dire Straits - Tunnel Of Love' },
  { src: './assets/Fat Larry s Band - Act Like You Know.mp3', title: 'Fat Larry s Band - Act Like You Know' },
  { src: './assets/Natural Mystic (1977) - Bob Marley The Wailers.mp3', title: 'Bob Marley - Natural Mystic' },
];

const MODULE_META = {
  playlist: { title: 'Playlist', cardClass: 'card-playlist', dataCard: 'playlist' },
  eq: { title: 'Égaliseur', cardClass: 'card-equalizer', dataCard: 'equalizer' },
  wam: { title: 'WAM', cardClass: 'card-wam', dataCard: 'wam' },
  viz: { title: 'Visualiseur', cardClass: 'card-visualizer', dataCard: 'visualizer' },
  controls: { title: 'Contrôles', cardClass: 'card-controls', dataCard: 'controls' },
};

const root = document.getElementById('modRoot');
const gridEl = document.getElementById('mainGrid');
const audio = document.getElementById('media');
const statusEl = document.getElementById('status');
const curTimeEl = document.getElementById('curtime');
const durEl = document.getElementById('duration');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progress-bar');
const bufferBar = document.getElementById('progress-buffer');

const toggles = {
  playlist: document.getElementById('togPlaylist'),
  eq: document.getElementById('togEq'),
  wam: document.getElementById('togWam'),
  viz: document.getElementById('togViz'),
  controls: document.getElementById('togControls'),
};

const shells = {};

let controlsEl = null;

let ctx = null;
let mediaSource = null;
let bridgeEq = null;
let gainNode = null;
let pannerNode = null;
let analyserNode = null;
let isGraphReady = false;

let plEl = null;
let eqEl = null;
let wamEl = null;
let vizEl = null;

let tracks = [...DEFAULT_TRACKS];
let playlistData = [...DEFAULT_TRACKS];
let currentIndex = 0;
let shuffle = false;
let loopMode = 0;
let shuffledIndices = [];
let _meterRunning = false;
let _boundKeyHandler = null;
let _boundDragMove = null;
let _boundDragUp = null;

function setStatus(t) {
  if (statusEl) statusEl.textContent = t;
}

function formatTime(sec) {
  if (Number.isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function getDockSlots() {
  return gridEl ? [...gridEl.querySelectorAll('.dock-slot')] : [];
}

function findDockSlotUnder(clientX, clientY) {
  return getDockSlots().find((slot) => {
    const r = slot.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  });
}

function syncSlotEmpty(slot) {
  if (!slot) return;
  const has = slot.querySelector('.card');
  slot.classList.toggle('dock-slot--empty', !has);
}

function setDetachButtonDocked(card, docked) {
  const btn = card.querySelector('.detach-btn');
  if (!btn) return;
  if (docked) {
    btn.textContent = '\u29c9';
    btn.title = 'Détacher le panneau';
    btn.setAttribute('aria-label', 'Détacher le panneau');
  } else {
    btn.textContent = '\u25a3';
    btn.title = 'Reposer le panneau';
    btn.setAttribute('aria-label', 'Reposer le panneau');
  }
}

function clearDetachedLayout(card) {
  card.classList.remove('detached');
  card.style.removeProperty('left');
  card.style.removeProperty('top');
  card.style.removeProperty('width');
  card.style.removeProperty('height');
  setDetachButtonDocked(card, true);
}

function appendToFirstEmptySlot(card) {
  for (const slot of getDockSlots()) {
    if (!slot.querySelector('.card')) {
      slot.appendChild(card);
      syncSlotEmpty(slot);
      return slot;
    }
  }
  return null;
}

function placeNewCard(card) {
  clearDetachedLayout(card);
  const slot = appendToFirstEmptySlot(card);
  if (!slot) {
    const w = Math.min(480, window.innerWidth * 0.45);
    const h = Math.min(360, window.innerHeight * 0.4);
    root.appendChild(card);
    card.classList.add('detached');
    card.style.left = `${(window.innerWidth - w) / 2}px`;
    card.style.top = `${(window.innerHeight - h) / 2}px`;
    card.style.width = `${w}px`;
    card.style.height = `${h}px`;
    setDetachButtonDocked(card, false);
  }
}

function ensureShell(moduleKey) {
  if (shells[moduleKey]) return shells[moduleKey];
  const meta = MODULE_META[moduleKey];
  const el = document.createElement('div');
  el.className = `card ${meta.cardClass}`.trim();
  el.dataset.card = meta.dataCard;
  el.dataset.moduleKey = moduleKey;
  const bodyExtra = moduleKey === 'eq' || moduleKey === 'wam' ? ' fx-scrollbar-y' : '';
  el.innerHTML = `
    <div class="card-header">
      <div class="title">${meta.title}</div>
      <button type="button" class="detach-btn" aria-label="Détacher le panneau" title="Détacher le panneau">\u29c9</button>
    </div>
    <div class="card-body${bodyExtra}"></div>
  `;
  shells[moduleKey] = { el, body: el.querySelector('.card-body') };
  return shells[moduleKey];
}

function detachCard(card) {
  const slot = card.closest('.dock-slot');
  const rect = card.getBoundingClientRect();
  if (slot) {
    card._dockOriginSlot = slot;
    card.remove();
    syncSlotEmpty(slot);
  }
  root.appendChild(card);
  card.classList.add('detached');
  card.style.left = `${rect.left}px`;
  card.style.top = `${rect.top}px`;
  card.style.width = `${rect.width}px`;
  card.style.height = `${rect.height}px`;
  setDetachButtonDocked(card, false);
}

function dockCard(card, targetSlot) {
  const slots = getDockSlots();
  if (!targetSlot) {
    targetSlot = slots.find((s) => !s.querySelector('.card')) || null;
  }
  if (!targetSlot) return;

  const existing = targetSlot.querySelector('.card');
  const origin = card._dockOriginSlot;

  if (existing && existing !== card) {
    if (origin) {
      origin.appendChild(existing);
      syncSlotEmpty(origin);
    } else {
      const alt = slots.find((s) => s !== targetSlot && !s.querySelector('.card'));
      if (alt) {
        alt.appendChild(existing);
        syncSlotEmpty(alt);
      } else {
        const r = existing.getBoundingClientRect();
        existing.remove();
        root.appendChild(existing);
        existing.classList.add('detached');
        existing.style.left = `${r.left}px`;
        existing.style.top = `${r.top}px`;
        existing.style.width = `${r.width}px`;
        existing.style.height = `${r.height}px`;
        existing._dockOriginSlot = undefined;
        setDetachButtonDocked(existing, false);
      }
    }
  }

  targetSlot.appendChild(card);
  card._dockOriginSlot = undefined;
  clearDetachedLayout(card);
  syncSlotEmpty(targetSlot);
  if (origin && origin !== targetSlot) syncSlotEmpty(origin);
}

function syncPlaylistDataFromDetail(d) {
  switch (d.action) {
    case 'add':
      if (d.track !== undefined) {
        playlistData.splice(d.index, 0, d.track);
        if (currentIndex !== -1 && currentIndex >= d.index) currentIndex++;
      }
      break;
    case 'remove':
      playlistData.splice(d.index, 1);
      if (currentIndex === d.index) currentIndex = -1;
      else if (currentIndex > d.index) currentIndex--;
      break;
    case 'reorder':
      if (d.from !== undefined && d.to !== undefined) {
        const t = playlistData.splice(d.from, 1)[0];
        playlistData.splice(d.to, 0, t);
        if (currentIndex === d.from) currentIndex = d.to;
        else if (d.from < currentIndex && d.to >= currentIndex) currentIndex--;
        else if (d.from > currentIndex && d.to <= currentIndex) currentIndex++;
      }
      break;
    default:
      break;
  }
}

function initShuffle() {
  if (!plEl) return;
  const list = plEl.getTracks();
  shuffledIndices = list.map((_, i) => i);
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
  }
}

function getNextTrackIndex() {
  if (!plEl) return undefined;
  const list = plEl.getTracks();
  const len = list.length;
  if (len === 0) return undefined;

  if (!shuffle) {
    const nxt = plEl.nextIndex();
    if (nxt !== undefined) return nxt;
    if (loopMode === 1) return 0;
    return undefined;
  }

  if (!shuffledIndices || shuffledIndices.length !== len) initShuffle();
  const curPos = shuffledIndices.indexOf(currentIndex);
  if (curPos === -1) {
    initShuffle();
    return shuffledIndices[0];
  }
  const nextPos = curPos + 1;
  if (nextPos < shuffledIndices.length) return shuffledIndices[nextPos];
  if (loopMode === 1) {
    initShuffle();
    return shuffledIndices[0];
  }
  return undefined;
}

function handleTrackEnd() {
  if (loopMode === 2) {
    audio.currentTime = 0;
    audio.play();
    return;
  }
  const nxt = getNextTrackIndex();
  if (nxt !== undefined && plEl) plEl.play(nxt);
}

function playNext() {
  const nxt = getNextTrackIndex();
  if (nxt !== undefined && plEl) plEl.play(nxt);
}

function playPrevious() {
  if (!plEl) return;
  const list = plEl.getTracks();
  if (list.length === 0) return;

  if (shuffle) {
    if (!shuffledIndices || shuffledIndices.length !== list.length) initShuffle();
    const curPos = shuffledIndices.indexOf(currentIndex);
    if (curPos > 0) {
      plEl.play(shuffledIndices[curPos - 1]);
      return;
    }
    if (loopMode === 1) {
      plEl.play(shuffledIndices[shuffledIndices.length - 1]);
    }
    return;
  }

  const prev = plEl.previousIndex();
  if (prev !== undefined) plEl.play(prev);
  else if (loopMode === 1) plEl.play(list.length - 1);
}

function rebuildAudioChain() {
  if (!ctx || !mediaSource || !gainNode) return;

  try {
    mediaSource.disconnect();
  } catch (_) {}

  if (eqEl) {
    try {
      eqEl.disconnectAll();
    } catch (_) {}
  }

  gainNode.disconnect();

  let tail = mediaSource;

  if (eqEl) {
    tail.connect(bridgeEq);
    eqEl.setAudioContext(ctx);
    eqEl.setInput(bridgeEq);
    tail = eqEl.getOutput();
  }

  if (wamEl) {
    wamEl.setAudioContext(ctx);
    wamEl.setInput(tail);
    tail = wamEl.getOutput();
  }

  tail.connect(gainNode);
  gainNode.connect(pannerNode);

  if (vizEl && analyserNode) {
    vizEl.setAnalyser(analyserNode);
  }
}

function initAudioGraph() {
  if (isGraphReady) return;

  ctx = new (window.AudioContext || window.webkitAudioContext)();
  mediaSource = ctx.createMediaElementSource(audio);
  bridgeEq = ctx.createGain();
  bridgeEq.gain.value = 1;
  gainNode = ctx.createGain();
  pannerNode = ctx.createStereoPanner();
  analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = 2048;
  analyserNode.smoothingTimeConstant = 0.8;

  gainNode.gain.value = controlsEl ? controlsEl.getVolumeValue() : 1;
  pannerNode.pan.value = controlsEl ? controlsEl.getBalanceValue() : 0;

  pannerNode.connect(analyserNode);
  analyserNode.connect(ctx.destination);

  isGraphReady = true;
  rebuildAudioChain();

  if (vizEl) {
    vizEl.setAnalyser(analyserNode);
    vizEl.start();
  }
}

async function ensureCtx() {
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
}

function removeModule(key) {
  if (key === 'viz' && vizEl) vizEl.stop();
  const rec = shells[key];
  if (rec?.el) {
    const card = rec.el;
    const slot = card.closest('.dock-slot');
    card.remove();
    if (slot) syncSlotEmpty(slot);
  }
  shells[key] = null;
  if (key === 'playlist') plEl = null;
  if (key === 'eq') eqEl = null;
  if (key === 'wam') wamEl = null;
  if (key === 'viz') vizEl = null;
  if (key === 'controls') controlsEl = null;
  if (isGraphReady) rebuildAudioChain();
}

function mountPlaylist() {
  const { el, body } = ensureShell('playlist');
  body.innerHTML = `
    <div class="add-track">
      <input type="url" id="newtrack" placeholder="https://..." />
      <button type="button" id="addtrack">Add URL</button>
      <input type="file" id="fileInput" accept="audio/*" style="display:none" multiple />
      <button type="button" id="fileBtn">Files…</button>
    </div>
  `;
  plEl = document.createElement('my-playlist');
  plEl.id = 'modPlaylist';
  body.appendChild(plEl);
  const initial = playlistData.length ? [...playlistData] : [...tracks];
  plEl.setTracks(initial);
  playlistData = [...plEl.getTracks()];
  tracks = [...playlistData];
  if (playlistData.length) {
    const first = playlistData[0];
    audio.src = first.src;
    currentIndex = 0;
    plEl.highlight(0);
    setStatus(first.title || '');
  }

  plEl.addEventListener('playlist-changed', (e) => {
    syncPlaylistDataFromDetail(e.detail);
    tracks = plEl.getTracks();
    playlistData = [...tracks];
  });

  plEl.addEventListener('play-track', async (e) => {
    const list = plEl.getTracks();
    const t = list[e.detail.index];
    if (!t) return;
    initAudioGraph();
    await ensureCtx();
    audio.src = t.src;
    currentIndex = e.detail.index;
    plEl.highlight(e.detail.index);
    setStatus(t.title || '');
    audio
      .play()
      .then(() => {
        if (vizEl) vizEl.start?.();
      })
      .catch(() => setStatus(`Erreur lecture: ${t.title || ''}`));
  });

  const addBtn = body.querySelector('#addtrack');
  const urlInput = body.querySelector('#newtrack');
  const fileBtn = body.querySelector('#fileBtn');
  const fileInput = body.querySelector('#fileInput');

  if (addBtn && urlInput) {
    const addTrackFromUrl = () => {
      const url = urlInput.value.trim();
      if (!url) return;
      try {
        const absolute = new URL(url, window.location.href).href;
        const title = absolute.split('/').pop()?.split('?')[0] || absolute;
        const probe = document.createElement('audio');
        probe.preload = 'metadata';
        probe.src = absolute;
        probe.addEventListener(
          'loadedmetadata',
          () => {
            plEl.addTrack({ src: absolute, title, duration: probe.duration || 0 });
            setStatus(`Ajouté: ${title}`);
          },
          { once: true }
        );
        probe.addEventListener(
          'error',
          () => {
            plEl.addTrack({ src: absolute, title });
            setStatus(`Ajouté: ${title}`);
          },
          { once: true }
        );
        urlInput.value = '';
      } catch {
        setStatus('URL invalide');
      }
    };
    addBtn.addEventListener('click', addTrackFromUrl);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTrackFromUrl();
    });
  }

  if (fileBtn && fileInput) {
    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      files.forEach((f) => {
        const objectUrl = URL.createObjectURL(f);
        const track = { src: objectUrl, title: f.name, duration: 0 };
        plEl.addTrack(track);
        const tAudio = document.createElement('audio');
        tAudio.src = objectUrl;
        tAudio.addEventListener('loadedmetadata', () => {
          track.duration = tAudio.duration;
          plEl.updateList?.();
        });
      });
      fileInput.value = '';
    });
  }

  placeNewCard(el);
}

function mountEq() {
  const { el, body } = ensureShell('eq');
  body.innerHTML = '';
  eqEl = document.createElement('my-equalizer');
  eqEl.setAttribute('compact', '');
  body.appendChild(eqEl);
  placeNewCard(el);
  if (isGraphReady) rebuildAudioChain();
}

function mountWam() {
  const { el, body } = ensureShell('wam');
  body.innerHTML = '';
  wamEl = document.createElement('wam-plugin');
  wamEl.setAttribute('name', 'WAM Effect');
  wamEl.setAttribute('src', WAM_DEFAULT);
  body.appendChild(wamEl);
  placeNewCard(el);
  if (isGraphReady) rebuildAudioChain();
}

function mountViz() {
  const { el, body } = ensureShell('viz');
  body.innerHTML = '';
  vizEl = document.createElement('my-visualizer');
  vizEl.setAttribute('mode', 'spectrum');
  vizEl.setAttribute('compact', '');
  body.appendChild(vizEl);
  placeNewCard(el);
  if (isGraphReady && analyserNode) {
    vizEl.setAnalyser(analyserNode);
    if (!audio.paused) vizEl.start();
  }
}

function mountControls() {
  const { el, body } = ensureShell('controls');
  body.innerHTML = '';
  controlsEl = document.createElement('my-player-controls');
  controlsEl.id = 'modPlayerControls';
  body.appendChild(controlsEl);
  wireControlsElement(controlsEl);
  placeNewCard(el);
}

function applyToggle(key) {
  const on = toggles[key].checked;
  if (key === 'playlist') {
    if (on) mountPlaylist();
    else removeModule('playlist');
  } else if (key === 'eq') {
    if (on) mountEq();
    else removeModule('eq');
  } else if (key === 'wam') {
    if (on) mountWam();
    else removeModule('wam');
  } else if (key === 'viz') {
    if (on) mountViz();
    else removeModule('viz');
  } else if (key === 'controls') {
    if (on) mountControls();
    else removeModule('controls');
  }
}

function wireControlsElement(ctr) {
  ctr.addEventListener('controls-play', async () => {
    initAudioGraph();
    await ensureCtx();
    try {
      await audio.play();
      if (vizEl) vizEl.start?.();
    } catch (err) {
      console.error(err);
    }
  });
  ctr.addEventListener('controls-pause', () => {
    audio.pause();
    if (vizEl) vizEl.stop?.();
  });
  ctr.addEventListener('controls-next', () => playNext());
  ctr.addEventListener('controls-prev', () => playPrevious());
  ctr.addEventListener('controls-shuffle', () => {
    shuffle = !shuffle;
    if (shuffle) initShuffle();
    ctr.setShuffleActive(shuffle);
  });
  ctr.addEventListener('controls-loop', () => {
    loopMode = (loopMode + 1) % 3;
    ctr.setLoopMode(loopMode);
  });
  ctr.addEventListener('controls-volume', (e) => {
    const v = e.detail.value;
    if (gainNode && ctx) gainNode.gain.setValueAtTime(v, ctx.currentTime);
    else audio.volume = v;
  });
  ctr.addEventListener('controls-balance', (e) => {
    const p = e.detail.value;
    if (pannerNode && ctx) pannerNode.pan.setValueAtTime(p, ctx.currentTime);
  });
}

function bindModularLayout() {
  let dragCard = null;
  let dragOffX = 0;
  let dragOffY = 0;
  let gutterDrag = null;
  let gutterStartPos = 0;
  let gutterStartSizes = [];
  let positionGutters = () => {};

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.detach-btn');
    if (!btn || !root.contains(btn)) return;
    const card = btn.closest('.card');
    if (!card || !root.contains(card)) return;
    if (card.classList.contains('detached')) dockCard(card);
    else detachCard(card);
  });

  root.addEventListener('mousedown', (e) => {
    const header = e.target.closest('.card-header');
    if (!header) return;
    const card = header.closest('.card');
    if (!card || !card.classList.contains('detached')) return;
    if (e.target.closest('.detach-btn')) return;
    e.preventDefault();
    dragCard = card;
    const rect = card.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
  });

  _boundDragMove = (e) => {
    if (gutterDrag !== null) {
      if (gutterDrag.type === 'col') {
        const delta = e.clientX - gutterStartPos;
        const newCols = [...gutterStartSizes];
        newCols[gutterDrag.index] = Math.max(150, gutterStartSizes[gutterDrag.index] + delta);
        newCols[gutterDrag.index + 1] = Math.max(150, gutterStartSizes[gutterDrag.index + 1] - delta);
        gridEl.style.gridTemplateColumns = newCols.map((w) => `${w}px`).join(' ');
      } else {
        const deltaY = e.clientY - gutterStartPos;
        const newRows = [...gutterStartSizes];
        newRows[gutterDrag.index] = Math.max(60, gutterStartSizes[gutterDrag.index] + deltaY);
        newRows[gutterDrag.index + 1] = Math.max(60, gutterStartSizes[gutterDrag.index + 1] - deltaY);
        gridEl.style.gridTemplateRows = newRows.map((h) => `${h}px`).join(' ');
      }
      positionGutters();
      return;
    }

    if (!dragCard) return;
    let x = e.clientX - dragOffX;
    let y = e.clientY - dragOffY;
    const SNAP = 15;
    const w = dragCard.offsetWidth;
    const h = dragCard.offsetHeight;

    const others = [...root.querySelectorAll('.card.detached')].filter((c) => c !== dragCard);
    for (const o of others) {
      const r = o.getBoundingClientRect();
      if (y + h > r.top && y < r.bottom) {
        if (Math.abs(x + w - r.left) < SNAP) x = r.left - w;
        else if (Math.abs(x - r.right) < SNAP) x = r.right;
      }
      if (x + w > r.left && x < r.right) {
        if (Math.abs(y + h - r.top) < SNAP) y = r.top - h;
        else if (Math.abs(y - r.bottom) < SNAP) y = r.bottom;
      }
      if (Math.abs(y - r.top) < SNAP) y = r.top;
      if (Math.abs(x - r.left) < SNAP) x = r.left;
    }
    dragCard.style.left = `${x}px`;
    dragCard.style.top = `${y}px`;

    getDockSlots().forEach((slot) => {
      const r = slot.getBoundingClientRect();
      const over =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      slot.classList.toggle('drag-hover', over);
    });
  };

  _boundDragUp = (e) => {
    if (gutterDrag !== null) {
      gutterDrag = null;
      root.querySelectorAll('.grid-gutter').forEach((g) => g.classList.remove('active'));
      return;
    }

    getDockSlots().forEach((slot) => slot.classList.remove('drag-hover'));

    if (!dragCard) return;
    const slot = findDockSlotUnder(e.clientX, e.clientY);
    if (slot && gridEl.contains(slot)) dockCard(dragCard, slot);
    dragCard = null;
  };

  window.addEventListener('mousemove', _boundDragMove);
  window.addEventListener('mouseup', _boundDragUp);

  const createGutter = (cls) => {
    const g = document.createElement('div');
    g.className = `grid-gutter ${cls}`;
    gridEl.appendChild(g);
    return g;
  };

  const colGutters = [createGutter('grid-gutter-col'), createGutter('grid-gutter-col')];
  const rowGutters = [createGutter('grid-gutter-row'), createGutter('grid-gutter-row')];

  positionGutters = () => {
    const gap = parseFloat(getComputedStyle(gridEl).gap) || 14;
    const cols = getComputedStyle(gridEl)
      .gridTemplateColumns.split(/\s+/)
      .map(parseFloat)
      .filter((n) => !Number.isNaN(n));
    const rows = getComputedStyle(gridEl)
      .gridTemplateRows.split(/\s+/)
      .map(parseFloat)
      .filter((n) => !Number.isNaN(n));

    if (cols.length >= 2) {
      let x = cols[0];
      colGutters[0].style.left = `${x + gap / 2 - 5}px`;
      colGutters[0].style.height = `${gridEl.scrollHeight}px`;
      colGutters[0].style.display = '';
      if (cols.length > 2) {
        x += gap + cols[1];
        colGutters[1].style.left = `${x + gap / 2 - 5}px`;
        colGutters[1].style.height = `${gridEl.scrollHeight}px`;
        colGutters[1].style.display = '';
      } else {
        colGutters[1].style.display = 'none';
      }
    } else {
      colGutters.forEach((g) => {
        g.style.display = 'none';
      });
    }

    if (rows.length >= 2) {
      let y = rows[0];
      rowGutters[0].style.top = `${y + gap / 2 - 5}px`;
      rowGutters[0].style.width = `${gridEl.scrollWidth}px`;
      rowGutters[0].style.display = '';
      if (rows.length > 2) {
        y += gap + rows[1];
        rowGutters[1].style.top = `${y + gap / 2 - 5}px`;
        rowGutters[1].style.width = `${gridEl.scrollWidth}px`;
        rowGutters[1].style.display = '';
      } else {
        rowGutters[1].style.display = 'none';
      }
    } else {
      rowGutters.forEach((g) => {
        g.style.display = 'none';
      });
    }
  };

  requestAnimationFrame(positionGutters);
  new ResizeObserver(positionGutters).observe(gridEl);

  colGutters.forEach((g, i) => {
    g.addEventListener('mousedown', (e) => {
      e.preventDefault();
      gutterStartSizes = getComputedStyle(gridEl)
        .gridTemplateColumns.split(/\s+/)
        .map(parseFloat)
        .filter((n) => !Number.isNaN(n));
      if (gutterStartSizes.length < 2) return;
      gutterStartPos = e.clientX;
      gutterDrag = { type: 'col', index: i };
      g.classList.add('active');
    });
  });

  rowGutters.forEach((g, i) => {
    g.addEventListener('mousedown', (e) => {
      e.preventDefault();
      gutterStartSizes = getComputedStyle(gridEl)
        .gridTemplateRows.split(/\s+/)
        .map(parseFloat)
        .filter((n) => !Number.isNaN(n));
      if (gutterStartSizes.length < 2) return;
      gutterStartPos = e.clientY;
      gutterDrag = { type: 'row', index: i };
      g.classList.add('active');
    });
  });
}

const updateMeter = () => {
  if (!_meterRunning) return;
  requestAnimationFrame(updateMeter);
  if (!analyserNode) return;
  const timeData = new Uint8Array(analyserNode.fftSize);
  analyserNode.getByteTimeDomainData(timeData);
  let sumSq = 0;
  for (let i = 0; i < timeData.length; i++) {
    const c = (timeData[i] - 128) / 128;
    sumSq += c * c;
  }
  const rms = Math.sqrt(sumSq / timeData.length);
  const pct = Math.min(100, Math.max(0, rms * 140));
  if (controlsEl) controlsEl.setMeterPercent(pct);
};

audio.addEventListener('play', async () => {
  if (!_meterRunning) {
    _meterRunning = true;
    updateMeter();
  }
  if (!isGraphReady) {
    initAudioGraph();
    await ensureCtx();
  }
  if (vizEl && analyserNode) vizEl.start?.();
});

audio.addEventListener('pause', () => {
  _meterRunning = false;
  if (controlsEl) controlsEl.setMeterPercent(0);
});

audio.addEventListener('ended', () => {
  _meterRunning = false;
  if (controlsEl) controlsEl.setMeterPercent(0);
  handleTrackEnd();
});

audio.addEventListener('loadedmetadata', () => {
  if (durEl) durEl.textContent = formatTime(audio.duration);
  if (playlistData.length && typeof currentIndex === 'number') {
    setStatus(playlistData[currentIndex]?.title || '');
  }
});

audio.addEventListener('timeupdate', () => {
  if (curTimeEl) curTimeEl.textContent = formatTime(audio.currentTime);
  if (progressBar && audio.duration) {
    const pct = (audio.currentTime / audio.duration) * 100;
    progressBar.style.width = `${pct}%`;
    if (progress) progress.setAttribute('aria-valuenow', String(Math.round(pct)));
  }
});

audio.addEventListener('progress', () => {
  if (bufferBar && audio.duration) {
    const buf = audio.buffered;
    if (buf.length) {
      const end = buf.end(buf.length - 1);
      const pct = (end / audio.duration) * 100;
      bufferBar.style.width = `${pct}%`;
    }
  }
});

if (progress) {
  progress.addEventListener('click', (e) => {
    const rect = progress.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    if (audio.duration) audio.currentTime = pct * audio.duration;
  });
  progress.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowRight')
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
    if (e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  });
}

_boundKeyHandler = (ev) => {
  const tag = (ev.target && ev.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || ev.target.isContentEditable) return;
  if (ev.code === 'Space') {
    ev.preventDefault();
    if (audio.paused) audio.play();
    else audio.pause();
  } else if (ev.code === 'ArrowRight') playNext();
  else if (ev.code === 'ArrowLeft') playPrevious();
};
window.addEventListener('keydown', _boundKeyHandler);

Object.keys(toggles).forEach((k) => {
  toggles[k].addEventListener('change', () => applyToggle(k));
});

['playlist', 'eq', 'wam', 'viz', 'controls'].forEach((k) => {
  if (toggles[k].checked) applyToggle(k);
});

getDockSlots().forEach(syncSlotEmpty);

bindModularLayout();
