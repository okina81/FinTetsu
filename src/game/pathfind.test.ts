import { describe, it, expect } from 'vitest';
import { reachableDestinations } from './pathfind';
import { ROUTES, CITIES } from './mapData';

/** 実マップ（約350駅の近接グラフ）に対する到達計算の検証。 */
const adjacency = (id: string) => {
  const set = new Set<string>();
  for (const r of ROUTES) {
    if (r.from === id) set.add(r.to);
    if (r.to === id) set.add(r.from);
  }
  return set;
};

// 隣接が 2 つ以上ある駅を 1 つ選ぶ（分岐の検証用）。
const hub = CITIES.find((c) => adjacency(c.id).size >= 2)!;

describe('reachableDestinations', () => {
  it('1 歩で隣接駅すべてに到達できる', () => {
    const neigh = adjacency(hub.id);
    const dests = new Set(reachableDestinations(hub.id, 1).map((o) => o.dest));
    expect(dests).toEqual(neigh);
  });

  it('返す経路は [start, ..., dest] で長さ = steps + 1', () => {
    for (const o of reachableDestinations(hub.id, 1)) {
      expect(o.path[0]).toBe(hub.id);
      expect(o.path[o.path.length - 1]).toBe(o.dest);
      expect(o.path).toHaveLength(2);
    }
  });

  it('即時引き返しを禁止する（出発駅に戻らない）', () => {
    const dests = reachableDestinations(hub.id, 2).map((o) => o.dest);
    expect(dests).not.toContain(hub.id);
  });

  it('連結グラフでは歩数を増やすと到達先が広がる', () => {
    const one = reachableDestinations(hub.id, 1).length;
    const three = reachableDestinations(hub.id, 3).length;
    expect(three).toBeGreaterThanOrEqual(one);
  });
});
