/**
 * Play'n GO sound sprite engine — decodes RoO1000 mp3 atlases and plays named clips.
 */

const BASE = '/assets/rise-of-olympus/sounds';
const SAMPLE_RATE = 44100;

/** @type {AudioContext | null} */
let ctx = null;
/** @type {Map<string, { buffer: AudioBuffer, start: number, end: number }>} */
const clips = new Map();
/** @type {boolean} */
let ready = false;
/** @type {boolean} */
let unlocked = false;

/** @type {Map<string, { source: AudioBufferSourceNode, gain: GainNode }>} */
const loops = new Map();

/** @type {Map<string, number>} */
const cycle = new Map();

function ensureContext() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

export async function unlockAudio() {
  const ac = ensureContext();
  if (!ac) return false;
  if (ac.state === 'suspended') await ac.resume();
  unlocked = true;
  return true;
}

export function isSoundReady() {
  return ready;
}

/**
 * @param {string} manifestName e.g. sounds_mobile_1.json
 * @param {string} mp3Name
 */
async function loadManifest(manifestName, mp3Name) {
  const manifest = await fetch(`${BASE}/${manifestName}`).then((r) => r.json());
  const ac = ensureContext();
  if (!ac) return;

  const res = await fetch(`${BASE}/${mp3Name}`);
  const buf = await res.arrayBuffer();
  const buffer = await ac.decodeAudioData(buf.slice(0));

  for (const [name, spec] of Object.entries(manifest.sounds ?? {})) {
    if (name === 'empty') continue;
    clips.set(name, {
      buffer,
      start: spec.start / SAMPLE_RATE,
      end: spec.end / SAMPLE_RATE,
    });
  }
}

export async function loadGameSounds() {
  if (ready) return;
  await Promise.all([
    loadManifest('sounds_mobile_0.json', 'sounds_mobile_0.mp3'),
    loadManifest('sounds_mobile_1.json', 'sounds_mobile_1.mp3'),
    loadManifest('sounds_mobile_2.json', 'sounds_mobile_2.mp3'),
  ]);
  ready = true;
}

/**
 * @param {string} name
 * @param {{ volume?: number, loop?: boolean, key?: string }} [opts]
 */
export function playSound(name, opts = {}) {
  if (!ready || !unlocked) return null;
  const clip = clips.get(name);
  const ac = ensureContext();
  if (!clip || !ac) return null;

  const { volume = 1, loop = false, key } = opts;
  const duration = clip.end - clip.start;
  if (duration <= 0) return null;

  if (key && loops.has(key)) {
    stopLoop(key);
  }

  const source = ac.createBufferSource();
  const gain = ac.createGain();
  source.buffer = clip.buffer;
  source.loop = loop;
  if (loop) {
    source.loopStart = clip.start;
    source.loopEnd = clip.end;
  }
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ac.destination);
  source.start(0, clip.start, loop ? undefined : duration);

  if (key && loop) {
    loops.set(key, { source, gain });
  } else if (!loop) {
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  return source;
}

/** @param {string} key */
export function stopLoop(key) {
  const active = loops.get(key);
  if (!active) return;
  try {
    active.source.stop();
    active.source.disconnect();
    active.gain.disconnect();
  } catch {
    /* already stopped */
  }
  loops.delete(key);
}

/** @param {string} prefix e.g. 1044SymbolsLand @param {number} count */
export function playCycled(prefix, count = 3, volume = 1) {
  const n = (cycle.get(prefix) ?? 0) % count;
  cycle.set(prefix, n + 1);
  playSound(`${prefix}${n + 1}of${count}`, { volume });
}

/** @param {number} symbolId */
export function playSymbolWinSound(symbolId) {
  if (symbolId === 11) return playSound('1044SymScatterWin');
  if (symbolId >= 7) return playSound(`1044SymHp${symbolId - 6}Win`);
  if (symbolId >= 4) return playSound(`1044SymMp${symbolId - 3}Win`);
  if (symbolId >= 0) return playSound(`1044SymLp${symbolId + 1}Win`);
}

/** @param {number} godId 0=hades 1=poseidon 2=zeus */
export function playGodPpsSound(godId, out = false) {
  const gods = ['1044SfHadesPps', '1044SfPoseidonPps', '1044SfZeusPps'];
  const base = gods[godId] ?? gods[0];
  playSound(out ? `${base}Out` : base);
}

/** @param {number} sum */
export function playMultiplierValueSound(sum) {
  const clamped = Math.max(2, Math.min(15, Math.round(sum)));
  playSound(`1044SsMultiplierValueX${clamped}of15`);
}

/** Start base-game music loop */
export function startBaseMusic() {
  stopLoop('music');
  playSound('1044MusBgCfLvl2', { loop: true, volume: 0.35, key: 'music' });
}

/** Switch to free-spin music */
export function startFsMusic() {
  stopLoop('music');
  playSound('1044MusFs', { loop: true, volume: 0.4, key: 'music' });
}

export function stopMusic() {
  stopLoop('music');
}

/** @param {number} tier 1-3 */
export function playBigWinLevelup(tier = 1) {
  playSound(`1044BwLevelup${tier}of3`);
}

export function playWinCounterSweetener(step = 1) {
  playSound(`WinCounterSweetener${Math.min(4, step)}`);
}

/** @param {string} name @returns {number} duration ms or 0 */
export function getSoundDuration(name) {
  const clip = clips.get(name);
  if (!clip) return 0;
  return Math.max(0, (clip.end - clip.start) * 1000);
}
