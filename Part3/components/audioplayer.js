import './libs/webaudiocontrols.js';
import './myequalizer.js';
import './myvisualizer.js';
import './playlist.js';
import './wamplugin.js';

const style = `<link rel="stylesheet" href="${new URL('../css/player.css', import.meta.url)}">`;


class MyAudioPlayer extends HTMLElement {
  static get observedAttributes() { return ['src', 'data-tracks', 'tracks', 'layout']; }

  constructor(){
    super();
    this.attachShadow({mode:'open'});

    this.audioContext = null;
    this.sourceNode = null;
    this.eq = null;
    this.visualizer = null;

    this.gainNode = null;
    this.pannerNode = null;
    this.analyserNode = null;

    this.isGraphReady = false;

    this.currentIndex = 0;
    this.shuffle = false;
    this.loopMode = 0;
    this.shuffledIndices = [];
    this._boundKeyHandler = null;
    this._meterRunning = false;
  }

  connectedCallback(){
    const isFixedLayout = this.getAttribute('layout') === 'fixed';
    const src = this.getAttribute('src') || '';
    const html = `
      <div class="panel">
        <div class="header">
          <div class="brand">
            <div class="name">NEXUS AURAL</div>
            <div class="sub">SYNTHESIS · SIGNAL · VISION</div>
          </div>
          <div id="status" class="status"></div>
        </div>

        <audio id="myplayer" src="${src}" controls preload="metadata"></audio>
        <div class="time-info">
          <span id="curtime">0:00</span> / <span id="duration">0:00</span>
        </div>
        <div class="progress" id="progress">
          <div class="progress-buffer" id="progress-buffer"></div>
          <div class="progress-bar" id="progress-bar"></div>
        </div>

        <div class="grid">
          <div class="card card-playlist" data-card="playlist" style="grid-area:playlist">
            <div class="card-header">
              <div class="title">Playlist</div>
              <button class="detach-btn" title="Detach panel" aria-label="Detach panel">⧉</button>
            </div>
            <div class="add-track">
              <input type="url" id="newtrack" placeholder="https://..." />
              <button id="addtrack">Add URL</button>
              <input type="file" id="fileInput" accept="audio/*" style="display:none;" multiple />
              <button id="fileBtn">Files…</button>
            </div>
            <my-playlist id="playlist"></my-playlist>
          </div>

          <div class="card card-equalizer" data-card="equalizer" style="grid-area:equalizer">
            <div class="card-header">
              <div class="title">Equalizer</div>
              <button class="detach-btn" title="Detach panel" aria-label="Detach panel">⧉</button>
            </div>
            <my-equalizer id="eq" ${isFixedLayout ? 'compact' : ''}></my-equalizer>
          </div>

          <div class="card card-controls" data-card="controls" style="grid-area:controls">
            <div class="card-header">
              <div class="title">Controls</div>
              <button class="detach-btn" title="Detach panel" aria-label="Detach panel">⧉</button>
            </div>
            <div class="transport">
              <button id="playbtn">▶ Play</button>
              <button id="pausebtn">⏸ Pause</button>
            </div>
            <div class="transport" style="margin-bottom:14px;">
              <button id="prevbtn" title="Previous track">⏮ Prev</button>
              <button id="nextbtn" title="Next track">Next ⏭</button>
              <button id="shufflebtn" title="Toggle shuffle">🔀 Shuffle</button>
              <button id="loopbtn" title="Toggle loop">🔁 Loop</button>
            </div>
            <div class="row">
              <label for="volumeslider">Volume</label>
              <input type="range" id="volumeslider" min="0" max="1" step="0.01" value="1">
            </div>
            <div class="knobrow">
              <div class="small">Knob volume</div>
              <webaudio-knob id="Knobvolume" min="0" max="1" step="0.01" value="1"></webaudio-knob>
            </div>
            <div class="row" style="margin-top:14px;">
              <label for="balanceslider">Balance</label>
              <input type="range" id="balanceslider" min="-1" max="1" step="0.01" value="0">
            </div>
          </div>

          <div class="card card-wam" data-card="wam" style="grid-area:wam">
            <div class="card-header">
              <div class="title">WAM Effects</div>
              <button class="detach-btn" title="Detach panel" aria-label="Detach panel">⧉</button>
            </div>
            <wam-plugin id="wam1" name="WAM Effect" src="https://www.webaudiomodules.com/community/plugins/wimmics/graphicEqualizer/index.js"></wam-plugin>
          </div>

          <div class="card card-visualizer" data-card="visualizer" style="grid-area:visualizer">
            <div class="card-header">
              <div class="title">Visualizer</div>
              <button class="detach-btn" title="Detach panel" aria-label="Detach panel">⧉</button>
            </div>

            <my-visualizer id="viz" ${isFixedLayout ? 'compact' : ''}></my-visualizer>
            <div class="meter"><div id="volMeter"></div></div>
          </div>
        </div>
      </div>
    `;
    this.shadowRoot.innerHTML = style + html;

    const attr = this.getAttribute('data-tracks') || this.getAttribute('tracks');
    try {
      this.playlistData = attr ? JSON.parse(attr) : [{src: src, title:'Track 1'}];
    } catch (e) {
      console.warn('invalid playlist JSON', e);
      this.playlistData = [{src: src, title:'Track 1'}];
    }
    this.currentIndex = 0;
    const playlist = this.shadowRoot.querySelector('#playlist');
    if (playlist) playlist.setTracks(this.playlistData);
    const audioEl = this.shadowRoot.querySelector('#myplayer');
    if (audioEl && this.playlistData && this.playlistData[0]?.src) {
      audioEl.src = this.playlistData[0].src;
      const statusEl = this.shadowRoot.querySelector('#status');
      if(statusEl) {
        statusEl.textContent = this.playlistData[0].title || '';
        statusEl.setAttribute('role','status');
        statusEl.setAttribute('aria-live','polite');
      }
    }

    const ariaMap = [
      ['#playbtn','Play'], ['#pausebtn','Pause'], ['#nextbtn','Next track'], ['#prevbtn','Previous track'],
      ['#shufflebtn','Toggle shuffle'], ['#loopbtn','Toggle loop mode']
    ];
    ariaMap.forEach(([sel,label])=>{
      const el = this.shadowRoot.querySelector(sel);
      if(el) el.setAttribute('aria-label', label);
    });
    const vol = this.shadowRoot.querySelector('#volumeslider'); if(vol) vol.setAttribute('aria-label','Volume');
    const bal = this.shadowRoot.querySelector('#balanceslider'); if(bal) bal.setAttribute('aria-label','Balance');
    const progressEl = this.shadowRoot.querySelector('#progress'); if(progressEl) {
      progressEl.setAttribute('role','progressbar');
      progressEl.setAttribute('aria-valuemin','0');
      progressEl.setAttribute('aria-valuemax','100');
      progressEl.setAttribute('aria-valuenow','0');
      progressEl.tabIndex = 0;
      progressEl.addEventListener('keydown', (e)=>{
        const audio = this.shadowRoot.querySelector('#myplayer');
        if(!audio) return;
        if(e.code === 'ArrowRight') audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
        if(e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
      });
    }

    this.defineListeners();
  }

  initAudioGraph(audioElement, ui){
    if (this.isGraphReady) return;

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.sourceNode = this.audioContext.createMediaElementSource(audioElement);

    this.gainNode = this.audioContext.createGain();
    this.pannerNode = this.audioContext.createStereoPanner();
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.gainNode.gain.value = Number(ui.volumeSlider.value);
    this.pannerNode.pan.value = Number(ui.balanceSlider.value);

    this.eq = this.shadowRoot.querySelector('#eq');
    if (this.eq && this.eq.setAudioContext) {
      this.eq.setAudioContext(this.audioContext);
      this.eq.setInput(this.sourceNode);
      const eqOut = this.eq.getOutput();

      // Wire WAM plugin between EQ output and gain
      const wam = this.shadowRoot.querySelector('#wam1');
      if (wam && wam.setAudioContext) {
        wam.setAudioContext(this.audioContext);
        wam.setInput(eqOut);
        wam.getOutput().connect(this.gainNode);
      } else {
        eqOut.connect(this.gainNode);
      }
    } else {
      this.sourceNode.connect(this.gainNode);
    }

    this.gainNode.connect(this.pannerNode);
    this.pannerNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    this.isGraphReady = true;

    this.visualizer = this.shadowRoot.querySelector('#viz');
    if (this.visualizer && this.visualizer.setAnalyser) {
      this.visualizer.setAnalyser(this.analyserNode);
    }

  }

  async ensureAudioContextRunning(){
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
  }

  formatTime(sec){
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec/60);
    const s = Math.floor(sec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

  /**
   * Prochain index à jouer (ordre playlist ou ordre mélangé). En shuffle + loop all,
   * à la fin d’un passage mélangé on tire un **nouveau** mélange pour couvrir toutes les pistes
   * sur le long terme au lieu de repartir toujours de l’index 0.
   */
  getNextTrackIndex(){
    const playlistEl = this.shadowRoot.querySelector('#playlist');
    if(!playlistEl) return undefined;
    const tracks = playlistEl.getTracks();
    const len = tracks.length;
    if(len === 0) return undefined;

    if(!this.shuffle){
      const nxt = playlistEl.nextIndex();
      if(nxt !== undefined) return nxt;
      if(this.loopMode === 1) return 0;
      return undefined;
    }

    if(!this.shuffledIndices || this.shuffledIndices.length !== len){
      this.initShuffle();
    }
    const curPos = this.shuffledIndices.indexOf(this.currentIndex);
    if(curPos === -1){
      this.initShuffle();
      return this.shuffledIndices[0];
    }
    const nextPos = curPos + 1;
    if(nextPos < this.shuffledIndices.length){
      return this.shuffledIndices[nextPos];
    }
    if(this.loopMode === 1){
      this.initShuffle();
      return this.shuffledIndices[0];
    }
    return undefined;
  }

  handleTrackEnd(){
    const audioElement = this.shadowRoot.querySelector('#myplayer');
    const playlistEl = this.shadowRoot.querySelector('#playlist');
    if(!playlistEl) return;

    if(this.loopMode === 2){
      audioElement.currentTime = 0;
      audioElement.play();
    } else {
      const nxt = this.getNextTrackIndex();
      if(nxt !== undefined){
        playlistEl.play(nxt);
      }
    }
  }

  playNext(){
    const playlistEl = this.shadowRoot.querySelector('#playlist');
    if(!playlistEl) return;
    const nxt = this.getNextTrackIndex();
    if(nxt !== undefined){
      playlistEl.play(nxt);
    }
  }

  playPrevious(){
    const playlistEl = this.shadowRoot.querySelector('#playlist');
    if(!playlistEl) return;
    const tracks = playlistEl.getTracks();
    if(tracks.length === 0) return;

    if(this.shuffle){
      if(!this.shuffledIndices || this.shuffledIndices.length !== tracks.length){
        this.initShuffle();
      }
      const curPos = this.shuffledIndices.indexOf(this.currentIndex);
      if(curPos > 0){
        playlistEl.play(this.shuffledIndices[curPos - 1]);
        return;
      }
      if(this.loopMode === 1){
        playlistEl.play(this.shuffledIndices[this.shuffledIndices.length - 1]);
        return;
      }
      return;
    }

    const prev = playlistEl.previousIndex();
    if(prev !== undefined){
      playlistEl.play(prev);
    } else if(this.loopMode === 1){
      playlistEl.play(tracks.length - 1);
    }
  }

  toggleShuffle(){
    this.shuffle = !this.shuffle;
    if(this.shuffle){
      this.initShuffle();
    }
  }

  toggleLoop(){
    this.loopMode = (this.loopMode + 1) % 3;
  }

  initShuffle(){
    const playlistEl = this.shadowRoot.querySelector('#playlist');
    if(!playlistEl) return;
    const tracks = playlistEl.getTracks();
    this.shuffledIndices = [];
    for(let i = 0; i < tracks.length; i++){
      this.shuffledIndices.push(i);
    }
    for(let i = this.shuffledIndices.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledIndices[i], this.shuffledIndices[j]] = [this.shuffledIndices[j], this.shuffledIndices[i]];
    }
  }

  _detachCard(card) {
    const rect = card.getBoundingClientRect();
    const gridEl = this.shadowRoot.querySelector('.grid');
    const ph = document.createElement('div');
    ph.className = 'card-placeholder';
    ph.dataset.for = card.dataset.card;
    ph.style.gridArea = card.style.gridArea;
    ph.innerHTML = '<span class="ph-label">Drop here</span>';
    gridEl.insertBefore(ph, card);
    card.classList.add('detached');
    card.style.left = rect.left + 'px';
    card.style.top = rect.top + 'px';
    card.style.width = rect.width + 'px';
    card.style.removeProperty('grid-area');
    const btn = card.querySelector('.detach-btn');
    if (btn) { btn.textContent = '\u25a3'; btn.title = 'Dock panel'; btn.setAttribute('aria-label','Dock panel'); }
  }

  _dockCard(card, targetPh) {
    const phs = [...this.shadowRoot.querySelectorAll('.card-placeholder')];
    // If no target specified, find the card's own placeholder first, else first available
    if (!targetPh) {
      targetPh = phs.find(p => p.dataset.for === card.dataset.card) || phs[0];
    }
    if (!targetPh) return; // No slots available; stay detached
    card.classList.remove('detached');
    card.style.removeProperty('left');
    card.style.removeProperty('top');
    card.style.removeProperty('width');
    card.style.gridArea = targetPh.style.gridArea;
    targetPh.remove();
    const btn = card.querySelector('.detach-btn');
    if (btn) { btn.textContent = '\u29c9'; btn.title = 'Detach panel'; btn.setAttribute('aria-label','Detach panel'); }
  }

  defineListeners(){
    const audioElement = this.shadowRoot.querySelector('#myplayer');
    const playButton = this.shadowRoot.querySelector('#playbtn');
    const pauseButton = this.shadowRoot.querySelector('#pausebtn');
    const volumeSlider = this.shadowRoot.querySelector('#volumeslider');
    const knobVolume = this.shadowRoot.querySelector('#Knobvolume');
    const balanceSlider = this.shadowRoot.querySelector('#balanceslider');
    const volMeter = this.shadowRoot.querySelector('#volMeter');

    const viz = this.shadowRoot.querySelector('#viz');
    playButton.addEventListener('click', async ()=>{
      this.initAudioGraph(audioElement, {volumeSlider, balanceSlider});
      await this.ensureAudioContextRunning();
      try {
        await audioElement.play();
        viz.start?.();
      } catch (e) {
        console.error('Play failed', e);
      }
    });

    const curTimeEl = this.shadowRoot.querySelector('#curtime');
    const durEl = this.shadowRoot.querySelector('#duration');
    const progress = this.shadowRoot.querySelector('#progress');
    const progressBar = this.shadowRoot.querySelector('#progress-bar');
    const bufferBar = this.shadowRoot.querySelector('#progress-buffer');

    audioElement.addEventListener('loadedmetadata', ()=>{
      if (durEl) durEl.textContent = this.formatTime(audioElement.duration);
      const statusEl = this.shadowRoot.querySelector('#status');
      if (statusEl && this.playlistData && typeof this.currentIndex === 'number') {
        statusEl.textContent = this.playlistData[this.currentIndex]?.title || '';
      }
    });
    audioElement.addEventListener('timeupdate', ()=>{
      if (curTimeEl) curTimeEl.textContent = this.formatTime(audioElement.currentTime);
      if (progressBar && audioElement.duration) {
        const pct = (audioElement.currentTime / audioElement.duration) * 100;
        progressBar.style.width = pct + '%';
        if (progress) progress.setAttribute('aria-valuenow', String(Math.round(pct)));
      }
    });
    audioElement.addEventListener('progress', ()=>{
      if (bufferBar && audioElement.duration) {
        const buf = audioElement.buffered;
        if (buf.length) {
          const end = buf.end(buf.length-1);
          const pct = (end / audioElement.duration) * 100;
          bufferBar.style.width = pct + '%';
        }
      }
    });
    if(progress){
      progress.addEventListener('click', e=>{
        const rect = progress.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = x / rect.width;
        if(audioElement.duration) audioElement.currentTime = pct * audioElement.duration;
      });
    }


    const playlistEl = this.shadowRoot.querySelector('#playlist');
    if (playlistEl) {
      playlistEl.addEventListener('play-track', async e => {
        const idx = e.detail.index;
        const track = this.playlistData[idx];
        if (track && audioElement) {
          this.initAudioGraph(audioElement, {volumeSlider, balanceSlider});
          await this.ensureAudioContextRunning();
          audioElement.src = track.src;
          this.currentIndex = idx;
          playlistEl.highlight(idx);
          const statusEl = this.shadowRoot.querySelector('#status');
          if(statusEl) statusEl.textContent = track.title || '';
          audioElement.play().then(()=>viz.start?.()).catch(err=>{
            console.warn('play after playlist', err);
            if(statusEl) statusEl.textContent = `Erreur lecture: ${track.title || track.src}`;
          });
          this.updateMediaSession(track);
        }
      });

      playlistEl.addEventListener('playlist-changed', e => {
        const d = e.detail;
        switch(d.action){
          case 'add':
            if(d.track !== undefined) this.playlistData.splice(d.index, 0, d.track);
            break;
          case 'remove':
            this.playlistData.splice(d.index, 1);
            if(this.currentIndex === d.index) this.currentIndex = -1;
            else if(this.currentIndex > d.index) this.currentIndex--;
            break;
          case 'reorder':
            if(d.from !== undefined && d.to !== undefined){
              const t = this.playlistData.splice(d.from, 1)[0];
              this.playlistData.splice(d.to, 0, t);
              if(this.currentIndex === d.from) this.currentIndex = d.to;
              else if(d.from < this.currentIndex && d.to >= this.currentIndex) this.currentIndex--;
              else if(d.from > this.currentIndex && d.to <= this.currentIndex) this.currentIndex++;
            }
            break;
        }
      });

      const addBtn = this.shadowRoot.querySelector('#addtrack');
      const urlInput = this.shadowRoot.querySelector('#newtrack');
      const fileBtn = this.shadowRoot.querySelector('#fileBtn');
      const fileInput = this.shadowRoot.querySelector('#fileInput');
      if(addBtn && urlInput){
        const addTrackFromUrl = ()=>{
          const url = urlInput.value.trim();
          if(!url) return;
          try {
            const absolute = new URL(url, window.location.href).href;
            const title = absolute.split('/').pop()?.split('?')[0] || absolute;
            const probe = document.createElement('audio');
            probe.preload = 'metadata';
            probe.src = absolute;
            probe.addEventListener('loadedmetadata', ()=>{
              playlistEl.addTrack({src:absolute, title, duration: probe.duration || 0});
              const statusEl = this.shadowRoot.querySelector('#status');
              if(statusEl) statusEl.textContent = `Ajouté: ${title}`;
            }, { once: true });
            probe.addEventListener('error', ()=>{
              playlistEl.addTrack({src:absolute, title});
              const statusEl = this.shadowRoot.querySelector('#status');
              if(statusEl) statusEl.textContent = `Ajouté (métadonnées indisponibles): ${title}`;
            }, { once: true });
            urlInput.value = '';
          } catch {
            const statusEl = this.shadowRoot.querySelector('#status');
            if(statusEl) statusEl.textContent = 'URL invalide';
          }
        };
        addBtn.addEventListener('click', addTrackFromUrl);
        urlInput.addEventListener('keydown', (e)=>{
          if(e.key === 'Enter') addTrackFromUrl();
        });
      }
      if(fileBtn && fileInput){
        fileBtn.addEventListener('click', ()=> fileInput.click());
        fileInput.addEventListener('change', ()=>{
          const files = Array.from(fileInput.files || []);
          files.forEach(f=>{
            const objectUrl = URL.createObjectURL(f);
            const track = {src: objectUrl, title: f.name, duration:0};
            playlistEl.addTrack(track);
            const tAudio = document.createElement('audio');
            tAudio.src = objectUrl;
            tAudio.addEventListener('loadedmetadata', ()=>{
              track.duration = tAudio.duration;
              playlistEl.updateList && playlistEl.updateList();
            });
          });
          fileInput.value = '';
        });
      }
    }

    audioElement.addEventListener('ended', () => {
      this.handleTrackEnd();
    });

    audioElement.addEventListener('error', () => {
      const statusEl = this.shadowRoot.querySelector('#status');
      if(statusEl) statusEl.textContent = 'Erreur de lecture du média';
    });

    const nextBtn = this.shadowRoot.querySelector('#nextbtn');
    const prevBtn = this.shadowRoot.querySelector('#prevbtn');
    const shuffleBtn = this.shadowRoot.querySelector('#shufflebtn');
    const loopBtn = this.shadowRoot.querySelector('#loopbtn');

    if(nextBtn){
      nextBtn.addEventListener('click', ()=>{
        this.playNext();
      });
    }
    if(prevBtn){
      prevBtn.addEventListener('click', ()=>{
        this.playPrevious();
      });
    }
    if(shuffleBtn){
      shuffleBtn.addEventListener('click', ()=>{
        this.toggleShuffle();
        shuffleBtn.classList.toggle('active', this.shuffle);
      });
    }
    if(loopBtn){
      loopBtn.addEventListener('click', ()=>{
        this.toggleLoop();
        loopBtn.classList.toggle('active', this.loopMode > 0);
        loopBtn.textContent = this.loopMode === 0 ? '🔁 Loop' : this.loopMode === 1 ? '🔁 All' : '🔂 One';
      });
    }

    pauseButton.addEventListener('click', ()=>{
      audioElement.pause();
      viz.stop?.();
    });

    volumeSlider.addEventListener('input', (e)=>{
      const v = Number(e.target.value);
      if (knobVolume) knobVolume.value = v;
      if (this.gainNode) this.gainNode.gain.setValueAtTime(v, this.audioContext.currentTime);
      else audioElement.volume = v;
    });

    if (knobVolume){
      knobVolume.addEventListener('input', (e)=>{
        const v = Number(e.target.value);
        volumeSlider.value = v;
        if (this.gainNode) this.gainNode.gain.setValueAtTime(v, this.audioContext.currentTime);
        else audioElement.volume = v;
      });
    }

    balanceSlider.addEventListener('input', (e)=>{
      const p = Number(e.target.value);
      if (this.pannerNode) this.pannerNode.pan.setValueAtTime(p, this.audioContext.currentTime);
    });

    const updateMeter = () => {
      if (!this._meterRunning) return;
      requestAnimationFrame(updateMeter);
      if (!this.analyserNode) return;
      const timeData = new Uint8Array(this.analyserNode.fftSize);
      this.analyserNode.getByteTimeDomainData(timeData);
      let sumSq=0;
      for (let i=0;i<timeData.length;i++){
        const c = (timeData[i]-128)/128;
        sumSq += c*c;
      }
      const rms = Math.sqrt(sumSq/timeData.length);
      const pct = Math.min(100, Math.max(0, rms * 140));
      if (volMeter) volMeter.style.width = pct + '%';
    };

    audioElement.addEventListener('play', () => {
      if (!this._meterRunning) { this._meterRunning = true; updateMeter(); }
    });
    audioElement.addEventListener('pause', () => {
      this._meterRunning = false;
      if (volMeter) volMeter.style.width = '0%';
    });
    audioElement.addEventListener('ended', () => {
      this._meterRunning = false;
      if (volMeter) volMeter.style.width = '0%';
    });

    this._boundKeyHandler = (ev) => {
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || ev.target.isContentEditable) return;
      if (ev.code === 'Space'){
        ev.preventDefault();
        if (audioElement.paused) audioElement.play(); else audioElement.pause();
      } else if (ev.code === 'ArrowRight'){
        this.playNext();
      } else if (ev.code === 'ArrowLeft'){
        this.playPrevious();
      }
    };
    window.addEventListener('keydown', this._boundKeyHandler);

    // === Detachable Panels with Magnet Snap ===
    let dragCard = null, dragOffX = 0, dragOffY = 0;
    const shadowRoot = this.shadowRoot;
    const gridEl = shadowRoot.querySelector('.grid');
    let gutterDrag = null, gutterStartPos = 0, gutterStartSizes = [];
    let positionGutters = () => {};

    shadowRoot.querySelectorAll('.detach-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.card');
        if (card.classList.contains('detached')) this._dockCard(card);
        else this._detachCard(card);
      });
    });

    shadowRoot.addEventListener('mousedown', (e) => {
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

    this._boundDragMove = (e) => {
      // === Grid gutter resize ===
      if (gutterDrag !== null) {
        const delta = e.clientX - gutterStartPos;
        if (gutterDrag.type === 'col') {
          const newCols = [...gutterStartSizes];
          newCols[gutterDrag.index] = Math.max(150, gutterStartSizes[gutterDrag.index] + delta);
          newCols[gutterDrag.index + 1] = Math.max(150, gutterStartSizes[gutterDrag.index + 1] - delta);
          gridEl.style.gridTemplateColumns = newCols.map(w => w + 'px').join(' ');
        } else {
          const deltaY = e.clientY - gutterStartPos;
          const newRows = [...gutterStartSizes];
          newRows[gutterDrag.index] = Math.max(60, gutterStartSizes[gutterDrag.index] + deltaY);
          newRows[gutterDrag.index + 1] = Math.max(60, gutterStartSizes[gutterDrag.index + 1] - deltaY);
          gridEl.style.gridTemplateRows = newRows.map(h => h + 'px').join(' ');
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

      // Magnet snap to other detached panels
      const others = [...shadowRoot.querySelectorAll('.card.detached')].filter(c => c !== dragCard);
      for (const o of others) {
        const r = o.getBoundingClientRect();
        if (y + h > r.top && y < r.bottom) {
          if (Math.abs((x + w) - r.left) < SNAP) x = r.left - w;
          else if (Math.abs(x - r.right) < SNAP) x = r.right;
        }
        if (x + w > r.left && x < r.right) {
          if (Math.abs((y + h) - r.top) < SNAP) y = r.top - h;
          else if (Math.abs(y - r.bottom) < SNAP) y = r.bottom;
        }
        if (Math.abs(y - r.top) < SNAP) y = r.top;
        if (Math.abs(x - r.left) < SNAP) x = r.left;
      }
      dragCard.style.left = x + 'px';
      dragCard.style.top = y + 'px';

      // Visual feedback: highlight placeholder under cursor
      const phs = shadowRoot.querySelectorAll('.card-placeholder');
      phs.forEach(ph => {
        const r = ph.getBoundingClientRect();
        const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        ph.classList.toggle('drag-hover', over);
      });
    };

    this._boundDragUp = (e) => {
      // === Grid gutter resize end ===
      if (gutterDrag !== null) {
        gutterDrag = null;
        shadowRoot.querySelectorAll('.grid-gutter').forEach(g => g.classList.remove('active'));
        return;
      }

      if (!dragCard) return;
      // Check if dropped over a placeholder → dock there
      const phs = [...shadowRoot.querySelectorAll('.card-placeholder')];
      phs.forEach(p => p.classList.remove('drag-hover'));
      for (const ph of phs) {
        const r = ph.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          this._dockCard(dragCard, ph);
          dragCard = null;
          return;
        }
      }
      dragCard = null;
    };

    window.addEventListener('mousemove', this._boundDragMove);
    window.addEventListener('mouseup', this._boundDragUp);

    // === Grid Resize Gutters ===

    const createGutter = (cls) => {
      const g = document.createElement('div');
      g.className = 'grid-gutter ' + cls;
      gridEl.appendChild(g);
      return g;
    };

    const colGutters = [
      createGutter('grid-gutter-col'),
      createGutter('grid-gutter-col')
    ];
    const rowGutters = [
      createGutter('grid-gutter-row'),
      createGutter('grid-gutter-row')
    ];

    positionGutters = () => {
      const cols = getComputedStyle(gridEl).gridTemplateColumns.split(' ').map(parseFloat);
      const rows = getComputedStyle(gridEl).gridTemplateRows.split(' ').map(parseFloat);
      const gap = parseFloat(getComputedStyle(gridEl).gap) || 14;
      let x = cols[0];
      colGutters[0].style.left = (x + gap / 2 - 5) + 'px';
      colGutters[0].style.height = gridEl.scrollHeight + 'px';
      if (cols.length > 2) {
        x += gap + cols[1];
        colGutters[1].style.left = (x + gap / 2 - 5) + 'px';
        colGutters[1].style.height = gridEl.scrollHeight + 'px';
        colGutters[1].style.display = '';
      } else {
        colGutters[1].style.display = 'none';
      }
      let y = rows[0];
      rowGutters[0].style.top = (y + gap / 2 - 5) + 'px';
      rowGutters[0].style.width = gridEl.scrollWidth + 'px';
      if (rows.length > 2) {
        y += gap + rows[1];
        rowGutters[1].style.top = (y + gap / 2 - 5) + 'px';
        rowGutters[1].style.width = gridEl.scrollWidth + 'px';
        rowGutters[1].style.display = '';
      } else {
        rowGutters[1].style.display = 'none';
      }
    };

    requestAnimationFrame(positionGutters);
    new ResizeObserver(positionGutters).observe(gridEl);

    colGutters.forEach((g, i) => {
      g.addEventListener('mousedown', (e) => {
        e.preventDefault();
        gutterStartSizes = getComputedStyle(gridEl).gridTemplateColumns.split(' ').map(parseFloat);
        gutterStartPos = e.clientX;
        gutterDrag = { type: 'col', index: i };
        g.classList.add('active');
      });
    });

    rowGutters.forEach((g, i) => {
      g.addEventListener('mousedown', (e) => {
        e.preventDefault();
        gutterStartSizes = getComputedStyle(gridEl).gridTemplateRows.split(' ').map(parseFloat);
        gutterStartPos = e.clientY;
        gutterDrag = { type: 'row', index: i };
        g.classList.add('active');
      });
    });
  }

  disconnectedCallback(){
    if (this._boundKeyHandler) window.removeEventListener('keydown', this._boundKeyHandler);
    if (this._boundDragMove) window.removeEventListener('mousemove', this._boundDragMove);
    if (this._boundDragUp) window.removeEventListener('mouseup', this._boundDragUp);
    const viz = this.shadowRoot?.querySelector('#viz'); if(viz && viz.stop) viz.stop();
    if (this.audioContext && typeof this.audioContext.close === 'function'){
      this.audioContext.close().catch(()=>{});
      this.audioContext = null;
    }
  }

  setPlaylist(list){
    if(!Array.isArray(list)) return;
    this.playlistData = list;
    const pl = this.shadowRoot.querySelector('#playlist');
    if(pl && pl.setTracks) pl.setTracks(list);
    this.currentIndex = 0;
    const audioEl = this.shadowRoot.querySelector('#myplayer');
    if(audioEl && list[0] && list[0].src) audioEl.src = list[0].src;
  }

  getPlaylist(){
    return Array.isArray(this.playlistData) ? [...this.playlistData] : [];
  }

  setVolume(val){
    const v = Number(val);
    if(this.gainNode) this.gainNode.gain.setValueAtTime(v, this.audioContext.currentTime);
    const volSlider = this.shadowRoot.querySelector('#volumeslider');
    if(volSlider) volSlider.value = v;
  }

  setBalance(val){
    const p = Number(val);
    if(this.pannerNode) this.pannerNode.pan.setValueAtTime(p, this.audioContext.currentTime);
    const balSlider = this.shadowRoot.querySelector('#balanceslider');
    if(balSlider) balSlider.value = p;
  }

  getAudioContext(){ return this.audioContext; }
  getGainNode(){ return this.gainNode; }
  getPannerNode(){ return this.pannerNode; }
  getAnalyserNode(){ return this.analyserNode; }

  updateMediaSession(track){
    try {
      if (!('mediaSession' in navigator)) return;
      const artworkSrc = track.artwork || track.artworkUrl || track.artworkSrc || null;
      const metadataInit = {
        title: track.title || '',
        artist: track.artist || '',
        album: track.album || ''
      };
      if (artworkSrc) metadataInit.artwork = [{ src: artworkSrc,   sizes: '512x512', type: 'image/png' }];
      const metadata = new MediaMetadata(metadataInit);
      navigator.mediaSession.metadata = metadata;
      navigator.mediaSession.setActionHandler('play', async () => { const a = this.shadowRoot.querySelector('#myplayer'); await a.play(); });
      navigator.mediaSession.setActionHandler('pause', () => { const a = this.shadowRoot.querySelector('#myplayer'); a.pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrevious());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        const a = this.shadowRoot.querySelector('#myplayer');
        if (details.fastSeek && a.fastSeek) a.fastSeek(details.seekTime);
        else a.currentTime = details.seekTime;
      });
    } catch (err){
      console.warn('mediaSession not available', err);
    }
  }
}

customElements.define('my-audio-player', MyAudioPlayer);
export default MyAudioPlayer;