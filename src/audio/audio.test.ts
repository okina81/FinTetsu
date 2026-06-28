import { describe, it, expect } from 'vitest';
import { seGain } from './sfx';
import { bgmGain } from './bgm';

describe('audio gain', () => {
  it('seGain = master × se（0–1 にクランプ）', () => {
    expect(seGain(0.5, 0.8)).toBeCloseTo(0.4);
    expect(seGain(1.5, 1)).toBe(1); // master クランプ
    expect(seGain(-1, 0.5)).toBe(0);
  });

  it('bgmGain は控えめ（×0.16 係数）', () => {
    expect(bgmGain(1, 1)).toBeCloseTo(0.16);
    expect(bgmGain(0.5, 0.5)).toBeCloseTo(0.04);
    expect(bgmGain(0, 1)).toBe(0);
  });
});
