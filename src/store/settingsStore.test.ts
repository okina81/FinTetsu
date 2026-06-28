import { describe, it, expect } from 'vitest';
import { useSettingsStore, GAME_SPEEDS } from './settingsStore';

const s = () => useSettingsStore.getState();

describe('settingsStore', () => {
  it('音量は 0–1 にクランプされる', () => {
    s().setMasterVolume(1.5);
    expect(s().masterVolume).toBe(1);
    s().setMasterVolume(-0.3);
    expect(s().masterVolume).toBe(0);
    s().setSeVolume(0.4);
    expect(s().seVolume).toBeCloseTo(0.4);
  });

  it('ゲーム速度を設定できる', () => {
    for (const sp of GAME_SPEEDS) {
      s().setGameSpeed(sp);
      expect(s().gameSpeed).toBe(sp);
    }
  });
});
