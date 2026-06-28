import { useSettingsStore } from '@/store/settingsStore';

/**
 * 効果音エンジン（WebAudio で実行時合成・音源ファイル不要）。
 *
 * AudioContext はユーザー操作後でないと音を出せないため、最初の操作で
 * unlockAudio() を呼んで resume する。音量は settingsStore の
 * master × se を都度参照する。
 */

let ctx: AudioContext | null = null;

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

/** 効果音の実効ゲイン（純粋関数・テスト用）。 */
export function seGain(master: number, se: number): number {
  return Math.max(0, Math.min(1, master)) * Math.max(0, Math.min(1, se));
}

function gain(): number {
  const s = useSettingsStore.getState();
  return seGain(s.masterVolume, s.seVolume);
}

/** 初回ユーザー操作で AudioContext を起動／再開する。 */
export function unlockAudio(): void {
  const c = audioCtx();
  if (c && c.state === 'suspended') void c.resume();
}

type ToneOpts = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  /** 0–1 のこの音の相対音量。 */
  vol?: number;
  /** 周波数の終端（スイープ）。 */
  freqEnd?: number;
  delay?: number;
};

/** 1 音をエンベロープ付きで鳴らす。 */
function tone({
  freq,
  dur,
  type = 'sine',
  vol = 1,
  freqEnd,
  delay = 0,
}: ToneOpts) {
  const c = audioCtx();
  if (!c) return;
  const g = gain() * vol;
  if (g <= 0) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  // 軽いアタック → 指数減衰
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(g * 0.6, t0 + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const A4 = 440;
/** 半音オフセットから周波数。 */
const note = (semi: number) => A4 * Math.pow(2, semi / 12);

export const sfx = {
  /** サイコロ：短い上昇ブリップ。 */
  dice() {
    tone({ freq: 320, freqEnd: 720, dur: 0.18, type: 'square', vol: 0.5 });
  },
  /** 1 マス移動：軽いチック。 */
  step() {
    tone({ freq: 520, dur: 0.06, type: 'triangle', vol: 0.35 });
  },
  /** 到着：明るい二音チャイム。 */
  arrive() {
    tone({ freq: note(4), dur: 0.16, type: 'sine', vol: 0.6 });
    tone({ freq: note(11), dur: 0.22, type: 'sine', vol: 0.6, delay: 0.09 });
  },
  /** 支店設立／強化：きらめくアルペジオ。 */
  build() {
    [0, 4, 7].forEach((s, i) =>
      tone({
        freq: note(s + 7),
        dur: 0.18,
        type: 'triangle',
        vol: 0.5,
        delay: i * 0.06,
      }),
    );
  },
  /** 手数料支払い：低い下降音。 */
  fee() {
    tone({ freq: 300, freqEnd: 150, dur: 0.28, type: 'sawtooth', vol: 0.45 });
  },
  /** イベント：カテゴリで明暗を変える。 */
  event(category: 'chance' | 'happening' | 'regional') {
    if (category === 'happening') {
      tone({ freq: 260, freqEnd: 120, dur: 0.4, type: 'sawtooth', vol: 0.5 });
    } else {
      tone({ freq: note(7), dur: 0.16, type: 'sine', vol: 0.55 });
      tone({ freq: note(12), dur: 0.24, type: 'sine', vol: 0.55, delay: 0.1 });
    }
  },
  /** 勝利ファンファーレ。 */
  win() {
    [0, 4, 7, 12].forEach((s, i) =>
      tone({
        freq: note(s),
        dur: 0.3,
        type: 'triangle',
        vol: 0.6,
        delay: i * 0.12,
      }),
    );
  },
  /** UI クリック。 */
  click() {
    tone({ freq: 660, dur: 0.04, type: 'square', vol: 0.2 });
  },
};
