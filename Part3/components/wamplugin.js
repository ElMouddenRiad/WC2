class WamPlugin extends HTMLElement {
  static get observedAttributes() { return ['src', 'name']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.audioContext = null;
    this.pluginInstance = null;
    this.pluginDom = null;
    this.bypassed = false;
    this._pluginLoading = false;

    this._inputNode = null;
    this._outputNode = null;
    this._dryGain = null;
    this._wetGain = null;

    this._rendered = false;
  }

  connectedCallback() {
    if (!this._rendered) {
      this.render();
      this._rendered = true;
    }
  }

  disconnectedCallback() {
    this.destroyPlugin();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._rendered) return;
    if (name === 'src' && newValue && newValue !== oldValue) {
      if (this.audioContext) this.loadPlugin(newValue);
    }
    if (name === 'name') {
      const label = this.shadowRoot?.querySelector('#pluginName');
      if (label) label.textContent = newValue || 'WAM Plugin';
    }
  }

  render() {
    const pluginName = this.getAttribute('name') || 'WAM Plugin';
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="${new URL('../css/theme-futuristic.css', import.meta.url)}">
      <style>
        :host { display:block; font-family: var(--fx-font-ui), system-ui, sans-serif; font-size:12px; color: var(--fx-text); }
        .wam { display:flex; flex-direction:column; gap:6px; }
        .top { display:flex; align-items:center; gap:8px; justify-content:space-between; flex-wrap:wrap; }
        .top-left { display:flex; align-items:center; gap:6px; }
        .controls { display:flex; gap:6px; align-items:center; }
        input[type="url"] { flex:1; min-width:120px; padding:5px 8px; border-radius:8px; border:1px solid var(--fx-border); background:rgba(0,0,0,0.4); color:var(--fx-text); font-size:11px; }
        button { padding:4px 8px; border-radius:8px; background: var(--fx-surface-2); color:var(--fx-text); border:1px solid var(--fx-border); cursor:pointer; font-size:11px; font-weight:600; }
        button:hover { background: rgba(0,240,255,0.12); box-shadow: var(--fx-glow-cyan); border-color: var(--fx-border-strong); }
        button.active { background: rgba(0,240,255,0.2); border-color: var(--fx-cyan); color: var(--fx-cyan); }
        #pluginGui { margin-top:6px; width:100%; min-height:0; }
        #pluginGui > * { display:block; width:100%; min-height:200px; pointer-events:auto; }
        #pluginGui iframe { border:none; width:100%; min-height:300px; height:400px; border-radius:8px; border:1px solid var(--fx-border); }
        #pluginGui canvas { width:100%; cursor:crosshair; }
        #status { font-size:10px; color: var(--fx-text-dim); min-height:14px; }
        .label { font-family: var(--fx-font-display); font-weight:600; font-size:10px; text-transform:uppercase; letter-spacing:.12em; color: var(--fx-cyan); text-shadow: 0 0 8px rgba(0,240,255,0.35); }
      </style>
      <div class="wam">
        <div class="top">
          <div class="top-left">
            <span class="label" id="pluginName">${pluginName}</span>
          </div>
          <div class="controls">
            <input type="url" id="wamUrl" placeholder="WAM plugin URL…"
                   value="https://www.webaudiomodules.com/community/plugins/wimmics/graphicEqualizer/index.js" />
            <button id="loadBtn">Load</button>
            <button id="bypassBtn" aria-label="Bypass WAM effect">Bypass</button>
            <button id="guiBtn" aria-label="Toggle plugin GUI">GUI</button>
          </div>
        </div>
        <div id="status"></div>
        <div id="pluginGui"></div>
      </div>
    `;

    this.shadowRoot.querySelector('#loadBtn').addEventListener('click', () => {
      const url = this.shadowRoot.querySelector('#wamUrl').value.trim();
      if (url) this.loadPlugin(url);
    });
    this.shadowRoot.querySelector('#bypassBtn').addEventListener('click', () => this.toggleBypass());
    this.shadowRoot.querySelector('#guiBtn').addEventListener('click', () => this.toggleGUI());
  }

  setAudioContext(ctx) {
    if (!ctx) return;
    this.audioContext = ctx;
    this._inputNode = ctx.createGain();
    this._outputNode = ctx.createGain();
    this._dryGain = ctx.createGain();
    this._wetGain = ctx.createGain();

    this._dryGain.gain.value = 1;
    this._wetGain.gain.value = 0;

    this._inputNode.connect(this._dryGain);
    this._dryGain.connect(this._outputNode);

    const src = this.getAttribute('src');
    if (src) this.loadPlugin(src);
  }

  setInput(sourceNode) {
    if (sourceNode && this._inputNode) {
      sourceNode.connect(this._inputNode);
    }
  }

  getOutput() {
    return this._outputNode;
  }

  async loadPlugin(url) {
    const statusEl = this.shadowRoot?.querySelector('#status');
    if (!this.audioContext) {
      if (statusEl) statusEl.textContent = 'Waiting for AudioContext…';
      return;
    }
    if (this._pluginLoading) return;
    this._pluginLoading = true;

    try { new URL(url); } catch {
      if (statusEl) statusEl.textContent = 'Invalid URL';
      this._pluginLoading = false;
      return;
    }

    if (statusEl) statusEl.textContent = 'Loading WAM host SDK…';

    try {
      this.destroyPlugin();

      const { default: initializeWamHost } = await import(
        'https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js'
      );
      const [hostGroupId] = await initializeWamHost(this.audioContext);

      if (statusEl) statusEl.textContent = 'Loading plugin…';

      const { default: WAM } = await import(url);
      const pluginInstance = await WAM.createInstance(hostGroupId, this.audioContext);
      this.pluginInstance = pluginInstance;

      this._inputNode.disconnect();
      this._inputNode.connect(pluginInstance.audioNode);
      pluginInstance.audioNode.connect(this._wetGain);
      this._wetGain.connect(this._outputNode);
      this._inputNode.connect(this._dryGain);
      this._dryGain.connect(this._outputNode);

      if (this.bypassed) {
        this._wetGain.gain.value = 0;
        this._dryGain.gain.value = 1;
      } else {
        this._wetGain.gain.value = 1;
        this._dryGain.gain.value = 0;
      }

      if (statusEl) statusEl.textContent = `Loaded: ${pluginInstance.descriptor?.name || 'WAM plugin'}`;

      const guiContainer = this.shadowRoot?.querySelector('#pluginGui');
      if (guiContainer) {
        guiContainer.innerHTML = '';
        const gui = await pluginInstance.createGui();
        this.pluginDom = gui;
        guiContainer.appendChild(gui);
      }

      this.dispatchEvent(new CustomEvent('wam-loaded', { detail: { url, name: pluginInstance.descriptor?.name }, bubbles: true, composed: true }));

    } catch (err) {
      console.error('WAM load error:', err);
      if (statusEl) statusEl.textContent = `Error: ${err.message}`;
      this.dispatchEvent(new CustomEvent('wam-error', { detail: { url, error: err.message }, bubbles: true, composed: true }));
    } finally {
      this._pluginLoading = false;
    }
  }

  toggleBypass() {
    this.bypassed = !this.bypassed;
    const btn = this.shadowRoot?.querySelector('#bypassBtn');
    if (this.bypassed) {
      if (this._wetGain) this._wetGain.gain.value = 0;
      if (this._dryGain) this._dryGain.gain.value = 1;
      if (btn) btn.classList.add('active');
    } else {
      if (this._wetGain) this._wetGain.gain.value = 1;
      if (this._dryGain) this._dryGain.gain.value = 0;
      if (btn) btn.classList.remove('active');
    }
    this.dispatchEvent(new CustomEvent('wam-bypass', { detail: { bypassed: this.bypassed }, bubbles: true, composed: true }));
  }

  async toggleGUI() {
    const container = this.shadowRoot?.querySelector('#pluginGui');
    if (!container) return;
    if (this.pluginDom) {
      container.innerHTML = '';
      this.pluginDom = null;
    } else if (this.pluginInstance) {
      const gui = await this.pluginInstance.createGui();
      this.pluginDom = gui;
      container.appendChild(gui);
    }
  }

  showGUI() {
    if (!this.pluginDom && this.pluginInstance) this.toggleGUI();
  }

  hideGUI() {
    const container = this.shadowRoot?.querySelector('#pluginGui');
    if (container) container.innerHTML = '';
    this.pluginDom = null;
  }

  destroyPlugin() {
    if (this.pluginInstance) {
      try { this.pluginInstance.audioNode?.disconnect(); } catch(e){}
      this.pluginInstance = null;
    }
    this.pluginDom = null;
    const container = this.shadowRoot?.querySelector('#pluginGui');
    if (container) container.innerHTML = '';

    if (this._inputNode && this._outputNode && this._dryGain) {
      try { this._inputNode.disconnect(); } catch(e){}
      try { this._wetGain?.disconnect(); } catch(e){}
      this._inputNode.connect(this._dryGain);
      this._dryGain.connect(this._outputNode);
    }
  }

  isBypassed() {
    return this.bypassed;
  }
}

customElements.define('wam-plugin', WamPlugin);
export default WamPlugin;
