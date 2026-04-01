import './libs/webaudiocontrols.js';

class MyEqualizer extends HTMLElement {
  static get observedAttributes() { return ['compact']; }

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.audioContext = null;
    this.filters = [];
    this.outputGain = null;
    this.sourceNode = null;
    this.inputConnected = false;
    this.bypassed = false;
    this._rendered = false;

    this.bandFreqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    this.presets = {
      Flat: [0,0,0,0,0,0,0,0,0,0],
      'Bass Boost': [6,5,4,2,0,-1,-2,-3,-4,-5],
      Vocal: [-2,-1,1,3,4,3,1,0,-1,-2],
      Phone: [6,5,4,2,0,-6,-8,-10,-12,-12]
    };
  }

  connectedCallback() {
    if (!this._rendered) {
      this.render();
      this._rendered = true;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'compact' && this._rendered) {
      this.render();
    }
  }

  render() {
    const style = `<link rel="stylesheet" href="${new URL('../css/equalizer.css', import.meta.url)}">`;
    const html = `
      <div class="eq">
        <div class="top">
          <div><strong>10-band EQ</strong></div>
          <div class="controls">
            <label>Preset</label>
            <select id="presetSelect"></select>
            <button id="bypassBtn" aria-label="Toggle EQ bypass">Bypass</button>
          </div>
        </div>
        <div class="sliders" id="sliders"></div>
        <div class="foot">
          <div>freqs: ${this.bandFreqs.join(' Hz • ')} Hz</div>
          <div id="status"></div>
        </div>
      </div>
    `;
    this.shadowRoot.innerHTML = style + html;

    const presetSelect = this.shadowRoot.querySelector('#presetSelect');
    presetSelect.setAttribute('aria-label','Equalizer preset');
    for (const k of Object.keys(this.presets)) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      presetSelect.appendChild(opt);
    }

    const slidersContainer = this.shadowRoot.querySelector('#sliders');
    slidersContainer.innerHTML = '';
    this.sliderEls = [];
    const compact = this.hasAttribute('compact');
    const sliderWidth = compact ? 24 : 28;
    const sliderHeight = compact ? 94 : 120;
    this.bandFreqs.forEach((f, i) => {
      const div = document.createElement('div');
      div.className = 'band';
      div.innerHTML = `
        <div class="labelTop">${f}Hz</div>
        <webaudio-slider id="s${i}" direction="vert" tracking="abs" width="${sliderWidth}" height="${sliderHeight}"
          min="-12" max="12" step="0.1" value="0" class="eqv"></webaudio-slider>
        <label>${i+1}</label>
      `;
      slidersContainer.appendChild(div);
      this.sliderEls[i] = div.querySelector('webaudio-slider');
      if (this.sliderEls[i]){
        this.sliderEls[i].setAttribute('aria-label', `EQ band ${i+1} ${f} Hz`);
        this.sliderEls[i].tabIndex = 0;
      }
    });

    const bypassBtn = this.shadowRoot.querySelector('#bypassBtn');
    bypassBtn.addEventListener('click', () => this.toggleBypass());

    presetSelect.addEventListener('change', () => {
      const p = presetSelect.value;
      this.applyPreset(p);
      this.dispatchEvent(new CustomEvent('eq-preset', { detail: { preset: p }, bubbles: true, composed: true }));
    });

    for (let i = 0; i < this.sliderEls.length; i++) {
      this.sliderEls[i].addEventListener('input', (e)=>{
        const db = Number(e.target.value);
        if (this.filters[i]) {
          this.filters[i].gain.setValueAtTime(db, this.audioContext ? this.audioContext.currentTime : 0);
        }
        this.dispatchEvent(new CustomEvent('eq-change', { detail: { index: i, gain: db }, bubbles: true, composed: true }));
      });
    }
  }

  setAudioContext(ctx){
    if (!ctx) throw new Error('setAudioContext requires AudioContext');
    if (this.audioContext && this.audioContext === ctx) return;
    this.audioContext = ctx;

    this.filters = this.bandFreqs.map((freq) => {
      const f = this.audioContext.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = freq;
      f.Q.value = 1.0;
      f.gain.value = 0;
      return f;
    });

    this.outputGain = this.audioContext.createGain();
    this.outputGain.gain.value = 1;

    this.sliderEls?.forEach((sl, i) => {
      if (this.filters[i]) {
        const v = Number(sl ? sl.value : 0);
        this.filters[i].gain.setValueAtTime(v, this.audioContext.currentTime);
      }
    });
  }

  setInput(sourceNode){
    if (!this.audioContext) {
      throw new Error('setInput: audioContext not set. call setAudioContext(ctx) first.');
    }
    this.sourceNode = sourceNode;
    this.reconnectGraph();
    this.inputConnected = true;
  }

  disconnectAll(){
    try {
      if (!this.audioContext) return;
      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch(e){}
      }
      for (const f of this.filters) {
        try { f.disconnect(); } catch(e){}
      }
      try { this.outputGain.disconnect(); } catch(e){}
    } catch(e){}
    this.inputConnected = false;
  }

  reconnectGraph(){
    if (!this.sourceNode || !this.outputGain) return;
    this.disconnectAll();
    if (this.filters.length === 0) {
      this.sourceNode.connect(this.outputGain);
      return;
    }
    this.sourceNode.connect(this.filters[0]);
    for (let i = 0; i < this.filters.length - 1; i++) {
      this.filters[i].connect(this.filters[i+1]);
    }
    this.filters[this.filters.length-1].connect(this.outputGain);
  }

  getOutput(){
    return this.outputGain;
  }

  applyPreset(name){
    const preset = this.presets[name];
    if (!preset) return;
    preset.forEach((db, i) => {
      this.sliderEls[i].value = db;
      if (this.filters[i] && this.audioContext) {
        this.filters[i].gain.setValueAtTime(db, this.audioContext.currentTime);
      }
    });
    this.dispatchEvent(new CustomEvent('eq-preset-applied', { detail: { name }, bubbles: true, composed: true }));
  }

  toggleBypass(){
    this.bypassed = !this.bypassed;
    const bypassBtn = this.shadowRoot?.querySelector('#bypassBtn');
    if (this.bypassed) {
      this._savedGains = this.filters.map(f => f.gain.value);
      this.filters.forEach(f => {
        if (this.audioContext) f.gain.setValueAtTime(0, this.audioContext.currentTime);
      });
      if (bypassBtn) bypassBtn.classList.add('active');
    } else {
      if (this._savedGains) {
        this._savedGains.forEach((g, i) => {
          if (this.filters[i] && this.audioContext) {
            this.filters[i].gain.setValueAtTime(g, this.audioContext.currentTime);
          }
        });
      }
      if (bypassBtn) bypassBtn.classList.remove('active');
    }
    this.dispatchEvent(new CustomEvent('eq-bypass', { detail: { bypassed: this.bypassed }, bubbles: true, composed: true }));
  }

  isBypassed(){
    return this.bypassed;
  }

  disconnectedCallback(){
    this.disconnectAll();
    this.audioContext = null;
    this.filters = [];
    this.outputGain = null;
    this.sourceNode = null;
  }
}

customElements.define('my-equalizer', MyEqualizer);
export default MyEqualizer;