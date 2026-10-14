import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatAudio} from '../dist/2d/combat-audio.js';

class Param {
  constructor(value = 0) { this.value = value; this.events = []; }
  record(kind, value, time, extra) {
    assert.ok(Number.isFinite(value) && Number.isFinite(time), 'audio automation must be finite');
    if (kind === 'exponential') assert.ok(value > 0, 'exponential automation must stay positive');
    this.value = value; this.events.push({kind, value, time, extra});
  }
  setValueAtTime(value, time) { this.record('set', value, time); }
  linearRampToValueAtTime(value, time) { this.record('linear', value, time); }
  exponentialRampToValueAtTime(value, time) { this.record('exponential', value, time); }
  setTargetAtTime(value, time, constant) { assert.ok(constant > 0); this.record('target', value, time, constant); }
  cancelScheduledValues(time) { this.events.push({kind: 'cancel', time}); }
  cancelAndHoldAtTime(time) { this.events.push({kind: 'hold', time}); }
}

class Node {
  constructor(context, kind) {
    this.context = context; this.kind = kind; this.connections = new Set();
    for (const name of ['gain', 'frequency', 'detune', 'Q', 'playbackRate', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[name] = new Param(name === 'playbackRate' || name === 'gain' ? 1 : 0);
    context.nodes.push(this);
  }
  connect(node) { this.connections.add(node); return node; }
  disconnect() { this.connections.clear(); }
  getFloatTimeDomainData(array) { array.fill(0); }
  start(time) { assert.equal(this.started, undefined, 'a source starts only once'); assert.ok(time >= this.context.currentTime); this.started = time; }
  stop(time) { assert.ok(Number.isFinite(time)); this.stopAt = time; }
}

class Context {
  constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.nodes = []; this.buffers = []; this.destination = new Node(this, 'destination'); }
  createGain() { return new Node(this, 'gain'); }
  createDynamicsCompressor() { return new Node(this, 'compressor'); }
  createBiquadFilter() { return new Node(this, 'filter'); }
  createAnalyser() { return new Node(this, 'analyser'); }
  createOscillator() { return new Node(this, 'oscillator'); }
  createBufferSource() { return new Node(this, 'bufferSource'); }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({length: channels}, () => new Float32Array(length));
    const buffer = {length, sampleRate, getChannelData: channel => data[channel]};
    this.buffers.push(buffer); return buffer;
  }
  advance(seconds) {
    this.currentTime += seconds;
    for (const node of this.nodes) if (!node.ended && node.started !== undefined && node.stopAt <= this.currentTime) { node.ended = true; node.onended?.(); }
  }
}

const setup = (character = 'dragon') => {
  const context = new Context(), audio = new CombatAudio();
  audio.attach(context).update({mode: 'playing', enabled: true, hidden: false, character});
  return {audio, context};
};
const latest = audio => audio.snapshot().lastEvents.at(-1);

test('construction is safe without DOM or AudioContext; silent states never allocate sources', () => {
  const audio = new CombatAudio();
  audio.update({mode: 'playing', character: 'logo', hidden: false});
  assert.equal(audio.play('hit'), false);
  assert.equal(audio.attach(null), audio);
  assert.equal(audio.snapshot().contextState, 'idle');
  const context = new Context(); audio.update({mode: 'menu'}).attach(context);
  for (const state of [{mode: 'menu'}, {mode: 'paused'}, {mode: 'complete'}, {mode: 'playing', enabled: false}, {mode: 'playing', enabled: true, hidden: true}]) {
    audio.update({...state, character: 'logo'});
    assert.equal(audio.play('logoExplosion'), false);
    assert.equal(audio.snapshot().chainsaw.active, false);
  }
  assert.equal(audio.snapshot().counters.sourceStarts, 0);
  context.state = 'suspended'; audio.update({mode: 'playing', enabled: true, hidden: false});
  assert.equal(audio.snapshot().active, false);
});

test('attachment is idempotent, noise is cached, and replacing a context disconnects the old graph', () => {
  const {audio, context} = setup('logo'), initialNodes = context.nodes.length;
  audio.attach(context); audio.attach(context);
  assert.equal(context.nodes.length, initialNodes);
  assert.equal(context.buffers.length, 1);
  audio.play('logoExplosion'); audio.play('hit');
  context.advance(0.2); audio.play('hit');
  assert.equal(context.buffers.length, 1, 'combat must reuse its noise buffer');
  const next = new Context(); audio.attach(next);
  assert.ok(context.nodes.every(node => node.connections.size === 0), 'all old-context nodes are disconnected');
  assert.equal(audio.snapshot().counters.attachments, 2);
  assert.equal(audio.snapshot().sources, 5, 'only the new context motor remains');
  audio.stop(); next.advance(0.2);
  assert.equal(audio.snapshot().sources, 0);
});

test('a confirmed hit has more body than a swish, Claude is deeper, and combo timbre changes', () => {
  const {audio, context} = setup();
  const envelopePeak = start => Math.max(...context.nodes.slice(start).flatMap(node => node.gain.events.filter(event => event.kind === 'linear').map(event => event.value)));
  let first = context.nodes.length; audio.play('swing', {stage: 0}); const swishPeak = envelopePeak(first);
  first = context.nodes.length; audio.play('hit'); const hitPeak = envelopePeak(first), light = latest(audio);
  assert.ok(hitPeak > swishPeak * 3, 'confirmed hits must have substantially greater transient weight');
  context.advance(0.2); audio.play('hit', {heavy: true}); const heavy = latest(audio);
  assert.ok(heavy.bodyGain > light.bodyGain && heavy.crackGain > light.crackGain);
  const pitches = [light.pitch, heavy.pitch];
  for (let n = 0; n < 4; n++) { context.advance(0.2); audio.play('hit'); pitches.push(latest(audio).pitch); }
  assert.equal(new Set(pitches).size, 6, 'a six-hit phrase must not repeat one identical thump');
  assert.ok(latest(audio).crackGain > light.crackGain, 'later combo notes bring the crack forward');
  context.advance(1); audio.play('hit', {character: 'claude'}); const claude = latest(audio);
  assert.ok(claude.pitch < light.pitch && claude.bodyGain > light.bodyGain && claude.crackGain < light.crackGain);
  context.advance(1); assert.equal(audio.snapshot().voices, 0);
  assert.equal(audio.snapshot().sources, 0);
});

test('area clears and repeated actions have bounded polyphony and finite source lifetimes', () => {
  const {audio, context} = setup();
  for (let n = 0; n < 300; n++) audio.play('hit', {heavy: true, kill: true});
  assert.equal(audio.snapshot().byType.hit, 2, 'a single area clear schedules only two impact packets');
  assert.ok(audio.snapshot().counters.dropped >= 298);
  for (let n = 0; n < 100; n++) {
    // Advance scheduling time without dispatching onended to emulate a busy main thread.
    context.currentTime += 0.03;
    for (const type of ['hit', 'swing', 'skill', 'logoExplosion', 'dash', 'logoDash', 'parry']) audio.play(type, {heavy: true});
  }
  const bounded = audio.snapshot();
  assert.ok(bounded.voices <= bounded.settings.maxVoices);
  assert.ok(bounded.sources <= bounded.settings.maxVoices * 5);
  assert.equal(context.buffers.length, 1);
  context.advance(1);
  assert.equal(audio.snapshot().voices, 0); assert.equal(audio.snapshot().sources, 0);
  assert.ok(context.nodes.filter(node => node.started !== undefined).every(node => Number.isFinite(node.stopAt)));
});

test('Logo motor revs smoothly and fades on pause, menu, mute, hidden, or character change', () => {
  for (const exit of [{mode: 'paused'}, {mode: 'menu'}, {enabled: false}, {hidden: true}, {character: 'dragon'}]) {
    const {audio, context} = setup('logo'), idle = audio.snapshot();
    assert.equal(idle.chainsaw.active, true); assert.equal(idle.sources, 5);
    audio.update({dashing: true, hidden: false}); const rev = audio.snapshot();
    assert.ok(rev.chainsaw.frequency > idle.chainsaw.frequency && rev.chainsaw.gainTarget > idle.chainsaw.gainTarget);
    assert.equal(rev.counters.chainsStarted, 1, 'rev must reuse the running motor');
    const motorAutomation = context.nodes.filter(node => node.kind === 'oscillator').flatMap(node => node.frequency.events);
    assert.ok(motorAutomation.some(event => event.kind === 'target' && event.extra > 0.03), 'motor pitch transitions have a smoothing constant');
    audio.update({...exit, dashing: true});
    assert.equal(audio.snapshot().chainsaw.active, false);
    assert.equal(audio.snapshot().chainsaw.retiring, 1, 'the motor retains a short fade tail');
    context.advance(0.13);
    assert.equal(audio.snapshot().chainsaw.retiring, 0); assert.equal(audio.snapshot().sources, 0);
    assert.equal(audio.snapshot().counters.chainsStopped, 1);
  }
});

test('rapid Logo pause/resume is bounded, stop drains voices, and later updates can restart', () => {
  const {audio, context} = setup('logo');
  for (let n = 0; n < 100; n++) {
    audio.update({mode: 'paused', hidden: false}); audio.update({mode: 'playing', hidden: false});
    const state = audio.snapshot();
    assert.ok(state.chainsaw.retiring <= 1 && state.sources <= 10, 'at most two motor groups may coexist');
  }
  audio.play('logoExplosion'); audio.stop(); audio.stop();
  assert.equal(audio.play('hit'), false);
  context.advance(0.2);
  assert.equal(audio.snapshot().voices, 0); assert.equal(audio.snapshot().sources, 0);
  assert.equal(audio.snapshot().counters.sourceStarts, audio.snapshot().counters.sourceEnds);
  audio.update({mode: 'playing', enabled: true, hidden: false, character: 'dragon'});
  assert.equal(audio.play('parry'), true);
  context.advance(1); assert.equal(audio.snapshot().sources, 0);
});

test('Logo self-explosion gives the existing electric motor a short rev, then returns to idle', () => {
  const {audio, context} = setup('logo');
  audio.play('logoExplosion');
  assert.equal(audio.snapshot().chainsaw.revving, true);
  context.advance(0.3); audio.update({mode: 'playing', character: 'logo', dashing: false, hidden: false});
  assert.equal(audio.snapshot().chainsaw.revving, false);
  assert.equal(audio.snapshot().counters.chainsStarted, 1, 'a short rev must reuse the motor');
  audio.stop(); context.advance(0.2);
  assert.equal(audio.snapshot().sources, 0);
});

test('OfflineAudioContext can schedule before rendering without weakening real-context suspension gating', () => {
  const context = new Context(); context.state = 'suspended'; context.startRendering = () => {};
  const audio = new CombatAudio().attach(context).update({mode: 'playing', hidden: false, character: 'logo'});
  assert.equal(audio.play('hit'), true);
  assert.equal(audio.snapshot().chainsaw.active, true);
  context.state = 'closed'; audio.update({mode: 'playing', hidden: false});
  assert.equal(audio.play('hit'), false); assert.equal(audio.snapshot().chainsaw.active, false);
});
