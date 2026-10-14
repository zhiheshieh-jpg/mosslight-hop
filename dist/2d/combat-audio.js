// Original synthesized combat Foley. No recordings, downloads, or music changes.
const FLOOR = 0.0001;
const TYPES = new Set(['swing', 'hit', 'skill', 'logoDash', 'logoExplosion', 'dash', 'parry']);
const SETTINGS = Object.freeze({masterGain: 0.44, maxVoices: 12, hitWindow: 0.026, hitsPerWindow: 2, maxChains: 2});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const running = context => context && (context.state === 'running' || (context.state === 'suspended' && typeof context.startRendering === 'function'));
const disconnect = node => { try { node.disconnect(); } catch {} };
function hold(param, at) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(at);
  else { param.cancelScheduledValues(at); param.setValueAtTime(param.value, at); }
}
function approach(param, value, at, time = 0.025) {
  hold(param, at); param.setTargetAtTime(value, at, time);
}

export class CombatAudio {
  constructor() {
    this.context = null;
    this.mode = 'menu'; this.enabled = true; this.character = 'dragon';
    this.dashing = false; this.hidden = false; this.active = false;
    this.voices = new Set(); this.sources = new Set(); this.chains = new Set();
    this.chain = null; this.bus = null; this.noise = null; this.meter = null; this.revUntil = 0;
    this.gates = new Map(); this.hitWindowAt = -Infinity; this.windowHits = 0;
    this.lastHitAt = -Infinity; this.hitSerial = 0; this.swingStage = 0;
    this.lastEvents = [];
    this.counters = {played: 0, dropped: 0, sourceStarts: 0, sourceEnds: 0, peakSources: 0, peakVoices: 0, noiseBuilds: 0, attachments: 0, chainsStarted: 0, chainsStopped: 0};
    this.byType = Object.fromEntries([...TYPES].map(type => [type, 0]));
  }

  attach(context) {
    if (!context || this.context === context) return this;
    this._dispose();
    this.context = context;
    const bus = context.createGain(), compressor = context.createDynamicsCompressor(), highpass = context.createBiquadFilter(), meter = context.createAnalyser();
    bus.gain.value = 0;
    highpass.type = 'highpass'; highpass.frequency.value = 28; highpass.Q.value = 0.5;
    compressor.threshold.value = -18; compressor.knee.value = 16; compressor.ratio.value = 5;
    compressor.attack.value = 0.003; compressor.release.value = 0.12;
    meter.fftSize = 1024;
    bus.connect(highpass); highpass.connect(compressor); compressor.connect(meter); meter.connect(context.destination);
    this.bus = bus; this.meter = meter; this.graph = [bus, highpass, compressor, meter];
    this.samples = new Float32Array(meter.fftSize);
    // One deterministic, reusable buffer for all impact, swish and motor textures.
    this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.8), context.sampleRate);
    const data = this.noise.getChannelData(0); let seed = 0x6d2b79f5;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    this.counters.noiseBuilds++; this.counters.attachments++;
    this.gates.clear(); this.hitWindowAt = -Infinity; this.lastHitAt = -Infinity;
    this.update();
    return this;
  }

  update({mode = this.mode, enabled = this.enabled, character = this.character, dashing = false, hidden = !!globalThis.document?.hidden} = {}) {
    this.mode = mode; this.enabled = !!enabled;
    this.character = typeof character === 'string' ? character : character?.id || 'dragon';
    this.dashing = !!dashing; this.hidden = !!hidden;
    const active = !!(this.context && running(this.context) && this.enabled && !this.hidden && this.mode === 'playing');
    if (active !== this.active) {
      this.active = active;
      if (this.bus) approach(this.bus.gain, active ? SETTINGS.masterGain : 0, this.context.currentTime, active ? 0.018 : 0.012);
      if (!active) { this.revUntil = 0; for (const voice of this.voices) this._fadeVoice(voice); }
    }
    const wantsChain = active && this.character === 'logo';
    if (!wantsChain && this.chain) this._stopChain(this.chain);
    if (wantsChain && !this.chain) {
      // Rapid pause/resume cannot leave an unlimited collection of fading motors.
      if (this.chains.size >= SETTINGS.maxChains) this._cleanGroup(this.chains.values().next().value);
      this._startChain();
    }
    const revving = this.dashing || (active && this.context.currentTime < this.revUntil);
    if (this.chain && this.chain.revving !== revving) this._revChain(revving);
    return this;
  }

  play(type, event = {}) {
    if (!TYPES.has(type) || !this.active || !running(this.context) || this.hidden || globalThis.document?.hidden) return false;
    const now = this.context.currentTime;
    // A screen clear may emit dozens of hit events in a single simulation step.
    // Keep two distinct impacts, then let the clear/explosion sound carry the rest.
    if (type === 'hit') {
      if (now - this.hitWindowAt >= SETTINGS.hitWindow) { this.hitWindowAt = now; this.windowHits = 0; }
      if (this.windowHits >= SETTINGS.hitsPerWindow) { this.counters.dropped++; return false; }
    } else {
      const interval = type === 'logoExplosion' ? 0.14 : type === 'skill' ? 0.055 : 0.035;
      if (now - (this.gates.get(type) ?? -Infinity) < interval) { this.counters.dropped++; return false; }
    }
    if (this.voices.size >= SETTINGS.maxVoices) { this.counters.dropped++; return false; }
    if (type === 'hit') this.windowHits++; else this.gates.set(type, now);
    const character = event.character || event.characterId || this.character;
    if (character === 'logo' && (type === 'logoExplosion' || type === 'logoDash')) {
      this.revUntil = now + (type === 'logoExplosion' ? 0.24 : 0.14);
      if (this.chain && !this.chain.revving) this._revChain(true);
    }
    const claude = character === 'claude', heavy = !!event.heavy;
    if (type === 'swing') this.swingStage = Number.isFinite(event.stage) ? clamp(event.stage, 0, 2) : (this.swingStage + 1) % 3;
    if (type === 'hit' && now - this.lastHitAt > 0.8) this.hitSerial = 0;
    const index = type === 'hit' ? this.hitSerial++ % 6 : this.swingStage;
    if (type === 'hit') this.lastHitAt = now;
    const pitch = [0.94, 1.03, 1.11, 1.15, 1.23, 1.3][index] * (claude ? 0.81 : 1);
    const voice = this._group(this.voices, type);
    const profile = {type, character, heavy, stage: this.swingStage, pitch, bodyGain: 0, crackGain: 0};
    const tone = (frequency, end, duration, gain, wave = 'sine', delay = 0) => this._tone(voice, frequency, end, duration, gain, wave, delay);
    const noise = (duration, gain, frequency, filter = 'bandpass', delay = 0) => this._noise(voice, duration, gain, frequency, filter, delay);
    if (type === 'swing') {
      noise(claude ? 0.13 : 0.095, claude ? 0.14 : 0.11, (claude ? 1050 : 2050) * pitch);
      tone(440 * pitch, 95 * pitch, 0.075, 0.055, 'triangle');
    } else if (type === 'hit') {
      // The first three hits favour the body; the next three bring the crack forward.
      const crackPhase = index >= 3, weight = heavy ? 1.19 : 1;
      profile.bodyGain = (claude ? 0.66 : 0.55) * weight;
      profile.crackGain = (crackPhase ? 0.28 : 0.2) * weight * (claude ? 0.84 : 1);
      tone((heavy ? 116 : 139) * pitch, (claude ? 34 : 42) * pitch, heavy ? 0.23 : claude ? 0.19 : 0.15, profile.bodyGain);
      tone(260 * pitch, 79 * pitch, 0.095, claude ? 0.15 : 0.1, 'triangle');
      noise(heavy ? 0.067 : 0.044, profile.crackGain, (claude ? 1700 : 2700) * pitch, 'highpass');
      tone((claude ? 940 : 1700) * pitch, 280 * pitch, 0.029, heavy ? 0.11 : 0.085, 'triangle');
      if (heavy || event.kill) noise(0.035, event.kill ? 0.12 : 0.085, 3300 * pitch, 'bandpass', 0.028);
    } else if (type === 'skill') {
      const shock = event.kind === 'shockwave' || claude;
      tone(shock ? 97 : 220, shock ? 29 : 70, shock ? 0.34 : 0.24, shock ? 0.68 : 0.37);
      noise(shock ? 0.19 : 0.16, shock ? 0.3 : 0.2, shock ? 900 : 2800);
      tone(shock ? 185 : 980, shock ? 55 : 370, 0.15, 0.13, 'triangle', 0.018);
      if (shock) noise(0.045, 0.14, 2200, 'highpass', 0.026);
    } else if (type === 'logoExplosion') {
      tone(150, 30, 0.53, 0.8); tone(73, 32, 0.4, 0.18, 'triangle', 0.025);
      noise(0.34, 0.38, 1400, 'lowpass'); noise(0.07, 0.26, 2200, 'highpass');
      tone(1050, 85, 0.18, 0.11, 'sawtooth');
    } else if (type === 'parry') {
      tone(1450 * pitch, 930 * pitch, 0.14, 0.17, 'triangle');
      tone(2180 * pitch, 1700 * pitch, 0.075, 0.065, 'sine', 0.008);
      noise(0.029, 0.17, 4200, 'highpass'); tone(140, 55, 0.09, 0.24);
    } else {
      const logo = type === 'logoDash';
      noise(logo ? 0.16 : 0.13, logo ? 0.17 : 0.12, logo ? 2400 : 1650);
      tone(logo ? 340 : 390, logo ? 110 : 95, logo ? 0.16 : 0.12, logo ? 0.075 : 0.055, logo ? 'sawtooth' : 'triangle');
      if (logo) tone(95, 49, 0.14, 0.2);
    }
    this.counters.played++; this.byType[type]++;
    this.lastEvents.push(profile); if (this.lastEvents.length > 8) this.lastEvents.shift();
    this.counters.peakVoices = Math.max(this.counters.peakVoices, this.voices.size);
    return true;
  }

  _group(collection, type) {
    const gain = this.context.createGain(); gain.gain.value = 1; gain.connect(this.bus);
    const group = {collection, type, gain, nodes: [gain], sources: new Set(), ended: false, fading: false};
    collection.add(group); return group;
  }

  _source(group, source, start, end) {
    group.sources.add(source); this.sources.add(source); this.counters.sourceStarts++;
    this.counters.peakSources = Math.max(this.counters.peakSources, this.sources.size);
    source.onended = () => {
      if (this.sources.delete(source)) this.counters.sourceEnds++;
      group.sources.delete(source); disconnect(source);
      if (!group.sources.size) this._cleanGroup(group);
    };
    source.start(start); if (end !== undefined) source.stop(end);
  }

  _envelope(group, duration, gain, delay) {
    const at = this.context.currentTime + delay, env = this.context.createGain();
    env.gain.setValueAtTime(FLOOR, at);
    env.gain.linearRampToValueAtTime(gain, at + Math.min(0.004, duration * 0.1));
    env.gain.exponentialRampToValueAtTime(FLOOR, at + duration);
    env.connect(group.gain); group.nodes.push(env); return {at, env};
  }

  _tone(group, frequency, end, duration, gain, wave, delay) {
    const source = this.context.createOscillator(), {at, env} = this._envelope(group, duration, gain, delay);
    source.type = wave; source.frequency.setValueAtTime(frequency, at);
    source.frequency.exponentialRampToValueAtTime(Math.max(22, end), at + duration);
    source.connect(env); this._source(group, source, at, at + duration + 0.012);
  }

  _noise(group, duration, gain, frequency, type, delay) {
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), {at, env} = this._envelope(group, duration, gain, delay);
    source.buffer = this.noise; filter.type = type; filter.frequency.setValueAtTime(frequency, at); filter.Q.value = type === 'bandpass' ? 0.75 : 0.6;
    // A moving cutoff keeps the transient airy instead of a static burst of hiss.
    filter.frequency.exponentialRampToValueAtTime(Math.max(100, frequency * 0.45), at + duration);
    source.connect(filter); filter.connect(env); group.nodes.push(filter);
    this._source(group, source, at, at + duration + 0.012);
  }

  _startChain() {
    const context = this.context, at = context.currentTime, group = this._group(this.chains, 'chainsaw');
    const filter = context.createBiquadFilter(), amplitude = context.createGain();
    filter.type = 'lowpass'; filter.frequency.value = 2600; filter.Q.value = 0.7;
    amplitude.gain.value = 0.68; amplitude.connect(filter); filter.connect(group.gain);
    group.nodes.push(filter, amplitude); group.filter = filter;
    const motor = (wave, frequency, level) => {
      const source = context.createOscillator(), gain = context.createGain(); source.type = wave; source.frequency.value = frequency; gain.gain.value = level;
      source.connect(gain); gain.connect(amplitude); group.nodes.push(gain); this._source(group, source, at); return source;
    };
    group.motor = motor('sawtooth', 74, 0.2); group.teeth = motor('sawtooth', 149.5, 0.1); group.body = motor('triangle', 37, 0.08);
    const brush = context.createBufferSource(), brushGain = context.createGain(), brushFilter = context.createBiquadFilter();
    brush.buffer = this.noise; brush.loop = true; brushFilter.type = 'highpass'; brushFilter.frequency.value = 780; brushGain.gain.value = 0.16;
    brush.connect(brushFilter); brushFilter.connect(brushGain); brushGain.connect(amplitude); group.nodes.push(brushFilter, brushGain); group.brush = brush;
    this._source(group, brush, at);
    // Fast amplitude modulation gives the electric motor its rotating tooth chatter.
    const lfo = context.createOscillator(), depth = context.createGain(); lfo.type = 'sine'; lfo.frequency.value = 38; depth.gain.value = 0.2;
    lfo.connect(depth); depth.connect(amplitude.gain); group.nodes.push(depth); group.lfo = lfo; this._source(group, lfo, at);
    group.gain.gain.setValueAtTime(0, at); group.gain.gain.setTargetAtTime(0.34, at, 0.045);
    group.revving = false; group.gainTarget = 0.34; group.frequency = 74;
    this.chain = group; this.counters.chainsStarted++;
  }

  _revChain(dashing) {
    const chain = this.chain, at = this.context.currentTime, frequency = dashing ? 126 : 74;
    chain.revving = dashing; chain.frequency = frequency; chain.gainTarget = dashing ? 0.52 : 0.34;
    for (const [source, value] of [[chain.motor, frequency], [chain.teeth, frequency * 2.02], [chain.body, frequency / 2], [chain.lfo, dashing ? 63 : 38]]) approach(source.frequency, value, at, 0.055);
    approach(chain.brush.playbackRate, dashing ? 1.28 : 1, at, 0.06);
    approach(chain.filter.frequency, dashing ? 4500 : 2600, at, 0.045);
    approach(chain.gain.gain, chain.gainTarget, at, 0.04);
  }

  _fadeVoice(group) {
    if (group.fading || group.ended) return;
    group.fading = true;
    const at = this.context.currentTime;
    approach(group.gain.gain, 0, at, 0.009);
    for (const source of group.sources) try { source.stop(at + 0.06); } catch {}
  }

  _stopChain(group) {
    if (group.fading || group.ended) return;
    group.fading = true; this.counters.chainsStopped++;
    if (this.chain === group) this.chain = null;
    const at = this.context.currentTime; approach(group.gain.gain, 0, at, 0.022);
    for (const source of group.sources) try { source.stop(at + 0.12); } catch {}
  }

  _cleanGroup(group) {
    if (group.ended) return;
    group.ended = true;
    for (const source of group.sources) {
      source.onended = null; try { source.stop(this.context.currentTime); } catch {}
      if (this.sources.delete(source)) this.counters.sourceEnds++;
      disconnect(source);
    }
    group.sources.clear(); for (const node of group.nodes) disconnect(node);
    group.collection.delete(group); if (this.chain === group) this.chain = null;
  }

  stop() {
    this.mode = 'stopped'; this.active = false; this.revUntil = 0;
    if (this.bus) approach(this.bus.gain, 0, this.context.currentTime, 0.012);
    for (const voice of this.voices) this._fadeVoice(voice);
    if (this.chain) this._stopChain(this.chain);
    return this;
  }

  _dispose() {
    for (const group of [...this.voices, ...this.chains]) this._cleanGroup(group);
    for (const node of this.graph || []) disconnect(node);
    this.active = false; this.graph = []; this.bus = null; this.meter = null; this.noise = null; this.revUntil = 0;
  }

  snapshot() {
    let rms = 0;
    if (this.meter) { this.meter.getFloatTimeDomainData(this.samples); for (const sample of this.samples) rms += sample * sample; rms = Math.sqrt(rms / this.samples.length); }
    return {
      mode: this.mode, enabled: this.enabled, active: this.active, character: this.character, dashing: this.dashing, hidden: this.hidden,
      contextState: this.context?.state || 'idle', voices: this.voices.size, sources: this.sources.size, rms,
      chainsaw: {active: !!this.chain, revving: !!this.chain?.revving, frequency: this.chain?.frequency || 0, gainTarget: this.chain?.gainTarget || 0, retiring: this.chains.size - (this.chain ? 1 : 0)},
      settings: {...SETTINGS}, counters: {...this.counters}, byType: {...this.byType}, lastEvents: this.lastEvents.map(event => ({...event}))
    };
  }
}
