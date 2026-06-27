import { ROUTES } from './mapData';

/**
 * 路線グラフ上の移動計算。桃鉄式に「出目ちょうどの歩数」で到達できる
 * 都市を列挙する（来た道への即時引き返しは禁止）。
 */

/** 隣接リスト（無向グラフ）。 */
const ADJ: Record<string, string[]> = (() => {
  const adj: Record<string, string[]> = {};
  const add = (a: string, b: string) => {
    (adj[a] ??= []).push(b);
  };
  for (const r of ROUTES) {
    add(r.from, r.to);
    add(r.to, r.from);
  }
  return adj;
})();

export type MoveOption = {
  /** 到達する都市 id。 */
  dest: string;
  /** 出発地を含む通過経路（[start, ..., dest]、長さ = steps + 1）。 */
  path: string[];
};

/**
 * start から exactly `steps` 歩で到達できる移動先を列挙する。
 *
 * - 各ステップで隣接ノードへ進む。
 * - 直前にいたノードへは引き返せない（行き止まりを除く一般的なボードゲーム挙動）。
 * - 同一都市へ複数経路がある場合は最初に見つかった経路を採用する。
 */
export function reachableDestinations(
  start: string,
  steps: number,
): MoveOption[] {
  const found = new Map<string, string[]>();

  const walk = (
    node: string,
    prev: string | null,
    remaining: number,
    path: string[],
  ) => {
    if (remaining === 0) {
      if (node !== start && !found.has(node)) found.set(node, path);
      return;
    }
    const neighbors = ADJ[node] ?? [];
    for (const next of neighbors) {
      if (next === prev) continue; // 即時引き返し禁止
      walk(next, node, remaining - 1, [...path, next]);
    }
  };

  walk(start, null, steps, [start]);
  return [...found.entries()].map(([dest, path]) => ({ dest, path }));
}
