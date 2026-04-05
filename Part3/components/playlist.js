class MyPlaylist extends HTMLElement {
  static get observedAttributes(){ return ['tracks','data-tracks']; }

  attributeChangedCallback(name, oldValue, newValue){
    if(name === 'tracks' || name === 'data-tracks'){
      try{
        const arr = JSON.parse(newValue);
        if(Array.isArray(arr)){
          this.setTracks(arr);
        }
      }catch(e){
        console.warn('playlist: invalid JSON for tracks attribute', e);
      }
    }
  }

  constructor(){
    super();
    this.attachShadow({mode:'open'});
    this.tracks = [];
    this.current = -1;
    this.draggedIndex = null;
    this._rendered = false;
    this.removedStack = [];
    this._maxRemovedHistory = 40;
  }

  connectedCallback(){
    if (!this._rendered) {
      this.render();
      this._rendered = true;
    }
    this._hydrateFromTracksAttr();
  }

  _hydrateFromTracksAttr(){
    const attr = this.getAttribute('data-tracks') || this.getAttribute('tracks');
    if (!attr) return;
    try {
      const arr = JSON.parse(attr);
      if (Array.isArray(arr) && arr.length) this.setTracks(arr);
    } catch (e) {
      console.warn('playlist: invalid JSON for tracks attribute', e);
    }
  }

  disconnectedCallback(){
    const revoke = (t) => {
      if (t.src && t.src.startsWith('blob:')) {
        try { URL.revokeObjectURL(t.src); } catch(e){}
      }
    };
    this.tracks.forEach(revoke);
    this.removedStack.forEach(({ track }) => revoke(track));
  }

  render(){
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="${new URL('../css/playlist.css', import.meta.url)}">
      <ul id="list" class="fx-scrollbar-y"></ul>
      <div class="removed-panel" part="removed-panel" hidden>
        <div class="removed-head">
          <span class="removed-title">Supprimées récemment</span>
          <button type="button" class="btn-undo" id="btnUndoLast" title="Remettre la dernière piste supprimée">↩ Annuler</button>
          <button type="button" class="btn-clear-trash" id="btnClearTrash" title="Oublier l’historique sans restaurer">Vider</button>
        </div>
        <ul class="removed-list fx-scrollbar-y" id="removedList" aria-label="Pistes supprimées récemment"></ul>
      </div>
    `;
    const ul = this.shadowRoot.querySelector('#list');
    ul.addEventListener('dragover', (e)=>{
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    ul.addEventListener('drop', (e)=>{
      e.preventDefault();
      if(this.draggedIndex === null) return;
      const targetLi = e.target.closest('li');
      if(targetLi) return;
      const to = this.tracks.length - 1;
      if(to >= 0 && this.draggedIndex !== to){
        this.reorderTrack(this.draggedIndex, to);
      }
      this.onDragEnd(e);
    });
    const btnUndo = this.shadowRoot.querySelector('#btnUndoLast');
    const btnClear = this.shadowRoot.querySelector('#btnClearTrash');
    if (btnUndo) btnUndo.addEventListener('click', () => this.restoreLastRemoved());
    if (btnClear) btnClear.addEventListener('click', () => this.clearRemovedHistory());
    this.updateList();
  }

  updateList(){
    const ul = this.shadowRoot.querySelector('#list');
    if(!ul) return;
    ul.innerHTML = '';
    this.tracks.forEach((t,i)=>{
      const li = document.createElement('li');
      li.dataset.index = i;
      li.draggable = true;
      li.tabIndex = 0;
      if(i===this.current) li.classList.add('current');
      
      const info = document.createElement('div');
      info.className = 'track-info';
      const title = document.createElement('div');
      title.className = 'track-title fx-scrollbar-y';
      title.textContent = t.title || `Track ${i+1}`;
      const dur = document.createElement('div');
      dur.className = 'track-dur';
      dur.textContent = t.duration ? `${this.formatTime(t.duration)}` : '';
      info.appendChild(title);
      if(dur.textContent) info.appendChild(dur);
      
      const actions = document.createElement('div');
      actions.className = 'track-actions';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-del';
      delBtn.textContent = '✕';
      delBtn.setAttribute('aria-label','Delete track');
      delBtn.addEventListener('click', e=>{
        e.stopPropagation();
        this.removeTrack(i);
      });
      actions.appendChild(delBtn);
      
      li.appendChild(info);
      li.appendChild(actions);
      
      li.addEventListener('click', ()=>this.play(i));
      li.addEventListener('keydown', (e)=>{
        if(e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.play(i); }
        else if(e.code === 'Delete') { e.preventDefault(); this.removeTrack(i); }
      });
      li.addEventListener('dragstart', e=>this.onDragStart(e, i));
      li.addEventListener('dragover', e=>this.onDragOver(e, i));
      li.addEventListener('dragleave', e=>this.onDragLeave(e, i));
      li.addEventListener('drop', e=>this.onDrop(e, i));
      li.addEventListener('dragend', e=>this.onDragEnd(e));
      
      ul.appendChild(li);
    });
    this._renderRemovedList();
  }

  _renderRemovedList(){
    const panel = this.shadowRoot.querySelector('.removed-panel');
    const rList = this.shadowRoot.querySelector('#removedList');
    const btnUndo = this.shadowRoot.querySelector('#btnUndoLast');
    if (!panel || !rList) return;
    const has = this.removedStack.length > 0;
    panel.hidden = !has;
    if (btnUndo) btnUndo.disabled = !has;
    rList.innerHTML = '';
    for (let s = this.removedStack.length - 1; s >= 0; s--) {
      const entry = this.removedStack[s];
      const li = document.createElement('li');
      li.className = 'removed-item';
      const t = entry.track;
      const titleSpan = document.createElement('span');
      titleSpan.className = 'removed-item-title';
      titleSpan.textContent = t.title || t.src || 'Piste';
      li.appendChild(titleSpan);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-restore';
      btn.textContent = 'Restaurer';
      btn.setAttribute('aria-label', `Restaurer ${t.title || 'piste'}`);
      const stackIndex = s;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.restoreRemovedAt(stackIndex);
      });
      li.appendChild(btn);
      rList.appendChild(li);
    }
  }

  onDragStart(e, index){
    this.draggedIndex = index;
    e.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(e, index){
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const li = e.currentTarget;
    li.classList.add('drag-over');
  }

  onDragLeave(e, index){
    const li = e.currentTarget;
    li.classList.remove('drag-over');
  }

  onDrop(e, index){
    e.preventDefault();
    const li = e.currentTarget;
    li.classList.remove('drag-over');
    if(this.draggedIndex !== null && this.draggedIndex !== index){
      this.reorderTrack(this.draggedIndex, index);
    }
  }

  onDragEnd(e){
    this.draggedIndex = null;
    const items = this.shadowRoot.querySelectorAll('li');
    items.forEach(li=>li.classList.remove('drag-over'));
  }

  formatTime(sec){
    const m = Math.floor(sec/60);
    const s = Math.floor(sec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

  setTracks(list){
    if (!this._rendered) {
      this.render();
      this._rendered = true;
    }
    this.tracks = Array.isArray(list) ? [...list] : [];
    this.current = -1;
    this.removedStack = [];
    this.updateList();
  }

  play(index){
    if(index < 0 || index >= this.tracks.length) return;
    this.current = index;
    this.updateList();
    this.dispatchEvent(new CustomEvent('play-track', { detail: { index }, bubbles: true, composed: true }));
  }

  highlight(index){
    this.current = index;
    this.updateList();
  }

  removeTrack(index){
    if(index < 0 || index >= this.tracks.length) return;
    const removed = this.tracks[index];
    this.removedStack.push({ track: removed, index });
    if (this.removedStack.length > this._maxRemovedHistory) this.removedStack.shift();
    this.tracks.splice(index, 1);
    if(this.current === index) this.current = -1;
    else if(this.current > index) this.current--;
    this.updateList();
    this.dispatchEvent(new CustomEvent('playlist-changed', { detail: { action: 'remove', index, track: removed }, bubbles: true, composed: true }));
  }

  restoreLastRemoved(){
    if (!this.removedStack.length) return;
    const entry = this.removedStack.pop();
    this._insertTrackAt(entry.track, entry.index);
  }

  restoreRemovedAt(stackIndex){
    if (stackIndex < 0 || stackIndex >= this.removedStack.length) return;
    const entry = this.removedStack.splice(stackIndex, 1)[0];
    this._insertTrackAt(entry.track, entry.index);
  }

  clearRemovedHistory(){
    this.removedStack = [];
    this._renderRemovedList();
  }

  getRemovedHistory(){
    return this.removedStack.map(e => ({ ...e, track: { ...e.track } }));
  }

  _probeDuration(track){
    if ((track.duration === undefined || track.duration === 0) && track.src) {
      const tAudio = document.createElement('audio');
      tAudio.preload = 'metadata';
      tAudio.src = track.src;
      tAudio.addEventListener('loadedmetadata', () => {
        track.duration = tAudio.duration;
        this.updateList();
      });
    }
  }

  _insertTrackAt(track, preferIndex){
    const at = Math.max(0, Math.min(preferIndex | 0, this.tracks.length));
    this.tracks.splice(at, 0, track);
    if (this.current !== -1 && this.current >= at) this.current++;
    this._probeDuration(track);
    this.updateList();
    this.dispatchEvent(new CustomEvent('playlist-changed', { detail: { action: 'add', index: at, track }, bubbles: true, composed: true }));
  }

  reorderTrack(from, to){
    if(from === to) return;
    const track = this.tracks[from];
    this.tracks.splice(from, 1);
    this.tracks.splice(to, 0, track);
    if(this.current === from) this.current = to;
    else if(from < this.current && to >= this.current) this.current--;
    else if(from > this.current && to <= this.current) this.current++;
    this.updateList();
    this.dispatchEvent(new CustomEvent('playlist-changed', { detail: { action: 'reorder', from, to }, bubbles: true, composed: true }));
  }

  nextIndex(){
    if(this.tracks.length === 0) return undefined;
    const nxt = this.current + 1;
    return nxt < this.tracks.length ? nxt : undefined;
  }

  previousIndex(){
    if(this.tracks.length === 0) return undefined;
    const prev = this.current - 1;
    return prev >= 0 ? prev : undefined;
  }

  getTracks(){
    return [...this.tracks];
  }

  addTrack(track){
    const index = this.tracks.length;
    this.tracks.push(track);
    this._probeDuration(track);
    this.updateList();
    this.dispatchEvent(new CustomEvent('playlist-changed', { detail: { action: 'add', index, track }, bubbles: true, composed: true }));
  }
}

customElements.define('my-playlist', MyPlaylist);
export default MyPlaylist;
