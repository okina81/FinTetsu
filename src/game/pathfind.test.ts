import { describe, it, expect } from 'vitest';
import { reachableDestinations } from './pathfind';

/**
 * 路線グラフ（mapData）に対する到達計算の検証。
 * 東京の隣接は yokohama / nagoya / sendai。
 */
describe('reachableDestinations', () => {
  it('1 歩で隣接都市すべてに到達できる', () => {
    const dests = reachableDestinations('tokyo', 1)
      .map((o) => o.dest)
      .sort();
    expect(dests).toEqual(['nagoya', 'sendai', 'yokohama']);
  });

  it('返す経路は [start, ..., dest] で長さ = steps + 1', () => {
    const opts = reachableDestinations('tokyo', 1);
    for (const o of opts) {
      expect(o.path[0]).toBe('tokyo');
      expect(o.path[o.path.length - 1]).toBe(o.dest);
      expect(o.path).toHaveLength(2);
    }
  });

  it('即時引き返しを禁止する（出発地に戻らない）', () => {
    // tokyo -> yokohama は行き止まり（yokohama の隣接は tokyo のみ）。
    // 2 歩では「引き返し」になるため yokohama 経由では戻れない。
    const dests = reachableDestinations('tokyo', 2).map((o) => o.dest);
    expect(dests).not.toContain('tokyo');
  });

  it('ちょうどの歩数でのみ到達先を返す', () => {
    // yokohama は 1 歩でのみ到達可能。2 歩の結果には含まれない
    // （唯一の隣接が tokyo で、引き返し禁止のため）。
    const twoSteps = reachableDestinations('tokyo', 2).map((o) => o.dest);
    expect(twoSteps).not.toContain('yokohama');
  });

  it('連結グラフでは歩数を増やすと到達先が広がる', () => {
    const one = reachableDestinations('tokyo', 1).length;
    const three = reachableDestinations('tokyo', 3).length;
    expect(three).toBeGreaterThan(one);
  });
});
