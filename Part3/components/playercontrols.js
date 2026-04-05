import './libs/webaudiocontrols.js';

const sheet = new URL('../css/player-controls.css', import.meta.url).href;

class MyPlayerControls extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (this.shadowRoot.querySelector('.transport')) return;
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="${sheet}">
      <div class="transport">
        <button type="button" id="playbtn">▶ Play</button>
        <button type="button" id="pausebtn">⏸ Pause</button>
      </div>
      <div class="transport" style="margin-bottom:14px;">
        <button type="button" id="prevbtn" title="Previous track">⏮ Prev</button>
        <button type="button" id="nextbtn" title="Next track">Next ⏭</button>
        <button type="button" id="shufflebtn" title="Toggle shuffle">🔀 Shuffle</button>
        <button type="button" id="loopbtn" title="Toggle loop">🔁 Loop</button>
      </div>
      <div class="row">
        <label for="volumeslider">Volume</label>
        <input type="range" id="volumeslider" min="0" max="1" step="0.01" value="1" aria-label="Volume" />
      </div>
      <div class="knobrow">
        <div class="small">Knob volume</div>
        <webaudio-knob id="Knobvolume" min="0" max="1" step="0.01" value="1"></webaudio-knob>
      </div>
      <div class="row" style="margin-top:14px;">
        <label for="balanceslider">Balance</label>
        <input type="range" id="balanceslider" min="-1" max="1" step="0.01" value="0" aria-label="Balance" />
      </div>
      <div class="meter"><div id="volMeter"></div></div>
    `;

    const fire = (name, detail = {}) => {
      this.dispatchEvent(
        new CustomEvent(name, { detail, bubbles: true, composed: true })
      );
    };

    this.shadowRoot.querySelector('#playbtn').addEventListener('click', () => fire('controls-play'));
    this.shadowRoot.querySelector('#pausebtn').addEventListener('click', () => fire('controls-pause'));
    this.shadowRoot.querySelector('#nextbtn').addEventListener('click', () => fire('controls-next'));
    this.shadowRoot.querySelector('#prevbtn').addEventListener('click', () => fire('controls-prev'));
    this.shadowRoot.querySelector('#shufflebtn').addEventListener('click', () => fire('controls-shuffle'));
    this.shadowRoot.querySelector('#loopbtn').addEventListener('click', () => fire('controls-loop'));

    const vol = this.shadowRoot.querySelector('#volumeslider');
    const knob = this.shadowRoot.querySelector('#Knobvolume');
    const bal = this.shadowRoot.querySelector('#balanceslider');

    vol.addEventListener('input', () => {
      if (knob) knob.value = vol.value;
      fire('controls-volume', { value: Number(vol.value) });
    });
    if (knob) {
      knob.addEventListener('input', () => {
        vol.value = knob.value;
        fire('controls-volume', { value: Number(knob.value) });
      });
    }
    bal.addEventListener('input', () => fire('controls-balance', { value: Number(bal.value) }));
  }

  getVolumeValue() {
    const el = this.shadowRoot?.querySelector('#volumeslider');
    return el ? Number(el.value) : 1;
  }

  getBalanceValue() {
    const el = this.shadowRoot?.querySelector('#balanceslider');
    return el ? Number(el.value) : 0;
  }

  setMeterPercent(pct) {
    const m = this.shadowRoot?.querySelector('#volMeter');
    if (m) m.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  setShuffleActive(on) {
    const b = this.shadowRoot?.querySelector('#shufflebtn');
    if (b) b.classList.toggle('active', on);
  }

  setLoopMode(mode) {
    const b = this.shadowRoot?.querySelector('#loopbtn');
    if (!b) return;
    b.classList.toggle('active', mode > 0);
    b.textContent = mode === 0 ? '🔁 Loop' : mode === 1 ? '🔁 All' : '🔂 One';
  }

  setVolumeValue(v) {
    const vol = this.shadowRoot?.querySelector('#volumeslider');
    const knob = this.shadowRoot?.querySelector('#Knobvolume');
    const n = String(Number(v));
    if (vol) vol.value = n;
    if (knob) knob.value = n;
  }

  setBalanceValue(p) {
    const bal = this.shadowRoot?.querySelector('#balanceslider');
    if (bal) bal.value = String(Number(p));
  }
}

customElements.define('my-player-controls', MyPlayerControls);
export default MyPlayerControls;
