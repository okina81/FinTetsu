import { useSettingsStore } from '@/store/settingsStore';

/**
 * 生成型アンビエント BGM（音源ファイル不要）。
 *
 * 低音のパッド和音をゆっくり進行させ、その上に淡いアルペジオを重ねる。
 * 音量は settingsStore の master × bgm を購読してリアルタイム反映。
 * AudioContext はユーザー操作後に start() すること。
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let chordTimer: ReturnType<typeof setInterval> | null = null;
let arpTimer: ReturnType<typeof setInterval> | null = null;
let unsub: (() => void) | null = null;
let running = false;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** BGM の実効ゲイン（控えめに：アンビエントとして主張しすぎない）。 */
export function bgmGain(masterVol: number, bgmVol: number): number {
  return (
    Math.max(0, Math.min(1, masterVol)) *
    Math.max(0, Math.min(1, bgmVol)) *
    0.16
  );
}

function applyVolume() {
  const c = audioCtx();
  if (!c || !master) return;
  const s = useSettingsStore.getState();
  master.gain.setTargetAtTime(
    bgmGain(s.masterVolume, s.bgmVolume),
    c.currentTime,
    0.2,
  );
}

const A2 = 110;
const semi = (base: number, n: number) => base * Math.pow(2, n / 12);
// ゆったりした 4 和音の進行（Am - F - C - G 風）
const PROGRESSION = [
  [0, 7, 12], // Am
  [-4, 3, 8], // F
  [3, 10, 15], // C
  [-2, 5, 10], // G
];
let chordIndex = 0;

function playChord(root: number[]) {
  const c = audioCtx();
  if (!c || !master) return;
  const t0 = c.currentTime;
  root.forEach((n, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = i === 0 ? 'sine' : 'triangle';
    osc.frequency.value = semi(A2, n);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.0);
    osc.connect(g).connect(master!);
    osc.start(t0);
    osc.stop(t0 + 5.2);
  });
}

function playArpNote() {
  const c = audioCtx();
  if (!c || !master) return;
  const chord = PROGRESSION[chordIndex];
  const n = chord[Math.floor(Math.random() * chord.length)] + 24; // 2 オクターブ上
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = semi(A2, n);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
  osc.connect(g).connect(master!);
  osc.start(t0);
  osc.stop(t0 + 1.5);
}

export function startBgm(): void {
  const c = audioCtx();
  if (!c || running) return;
  if (c.state === 'suspended') void c.resume();
  master = c.createGain();
  master.connect(c.destination);
  applyVolume();
  running = true;
  chordIndex = 0;
  playChord(PROGRESSION[0]);
  chordTimer = setInterval(() => {
    chordIndex = (chordIndex + 1) % PROGRESSION.length;
    playChord(PROGRESSION[chordIndex]);
  }, 5000);
  arpTimer = setInterval(playArpNote, 1250);
  // 音量設定の変更に追従
  unsub = useSettingsStore.subscribe(applyVolume);
}

export function stopBgm(): void {
  if (chordTimer) clearInterval(chordTimer);
  if (arpTimer) clearInterval(arpTimer);
  chordTimer = arpTimer = null;
  unsub?.();
  unsub = null;
  if (master && ctx) {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  }
  running = false;
}
