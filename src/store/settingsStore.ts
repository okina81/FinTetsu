import { create } from 'zustand';
import { storage } from '@/lib/persist';

/**
 * ユーザー設定（音量・ゲーム速度）。ゲーム状態とは独立に永続化し、
 * 起動時に localStorage から復元する。音量は次の「音」PR で
 * オーディオエンジンが購読して使用する。
 */

const KEY = 'fintetsu:settings';

export type SettingsState = {
  /** マスター音量 0–1。 */
  masterVolume: number;
  /** BGM 音量 0–1。 */
  bgmVolume: number;
  /** 効果音 音量 0–1。 */
  seVolume: number;
  /** ゲーム速度倍率（アニメ・CPU 思考時間に作用）。 */
  gameSpeed: number;

  setMasterVolume: (v: number) => void;
  setBgmVolume: (v: number) => void;
  setSeVolume: (v: number) => void;
  setGameSpeed: (v: number) => void;
};

export const GAME_SPEEDS = [0.5, 1, 1.5, 2] as const;

const DEFAULTS = {
  masterVolume: 0.7,
  bgmVolume: 0.5,
  seVolume: 0.8,
  gameSpeed: 1,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function loadPersisted(): typeof DEFAULTS {
  const saved = storage.getJSON<Partial<typeof DEFAULTS>>(KEY);
  return { ...DEFAULTS, ...(saved ?? {}) };
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const persist = () => {
    const { masterVolume, bgmVolume, seVolume, gameSpeed } = get();
    storage.setJSON(KEY, { masterVolume, bgmVolume, seVolume, gameSpeed });
  };

  return {
    ...loadPersisted(),

    setMasterVolume: (v) => {
      set({ masterVolume: clamp01(v) });
      persist();
    },
    setBgmVolume: (v) => {
      set({ bgmVolume: clamp01(v) });
      persist();
    },
    setSeVolume: (v) => {
      set({ seVolume: clamp01(v) });
      persist();
    },
    setGameSpeed: (v) => {
      set({ gameSpeed: v });
      persist();
    },
  };
});
