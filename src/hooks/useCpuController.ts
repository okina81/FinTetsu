import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

/**
 * CPU プレイヤーの自動操作を駆動する。
 *
 * ストアを購読し、現在プレイヤーが CPU のときフェーズに応じて
 * 時間差で行動する（roll → select → 移動アニメ → action → endTurn）。
 * 移動アニメ自体は PieceLayer が担い completeMove を呼ぶため、
 * ここでは moving フェーズには介入しない。
 *
 * 人間（あなた）の番では何もせず、UI 操作を待つ。
 */
export function useCpuController(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let handledKey = '';

    const ROLL_MS = 550;
    const SELECT_MS = 650;
    const ACTION_MS = 750;
    const ENDTURN_MS = 650;

    const handle = () => {
      const s = useGameStore.getState();
      const me = s.players[s.currentPlayerIndex];
      if (!me?.isCpu || s.phase === 'gameover') return;

      const key = `${s.turn}:${s.currentPlayerIndex}:${s.phase}`;
      if (key === handledKey) return; // 同一フェーズの二重発火を防ぐ
      if (s.phase === 'moving') return; // アニメ中は介入しない
      handledKey = key;

      if (s.phase === 'roll') {
        timer = setTimeout(() => useGameStore.getState().rollDice(), ROLL_MS);
      } else if (s.phase === 'select') {
        timer = setTimeout(() => {
          const st = useGameStore.getState();
          const dest = pickDestination(st);
          if (dest) st.chooseDestination(dest);
        }, SELECT_MS);
      } else if (s.phase === 'event') {
        // イベントカードを自動で確認して効果を適用
        timer = setTimeout(
          () => useGameStore.getState().applyEventCard(),
          ACTION_MS,
        );
      } else if (s.phase === 'action') {
        timer = setTimeout(() => {
          const st = useGameStore.getState();
          decideAction(st);
          timer = setTimeout(
            () => useGameStore.getState().endTurn(),
            ENDTURN_MS,
          );
        }, ACTION_MS);
      }
    };

    // 初期状態も評価し、以降の変化を購読
    handle();
    const unsub = useGameStore.subscribe(handle);

    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);
}

/** CPU の移動先選択：未所有の都市を優先し、なければランダム。 */
function pickDestination(
  s: ReturnType<typeof useGameStore.getState>,
): string | null {
  const dests = s.options.map((o) => o.dest);
  if (dests.length === 0) return null;
  const unowned = dests.filter((d) => !s.branches[d]);
  const pool = unowned.length > 0 ? unowned : dests;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** CPU の到着後行動：建てる→強化→地域育成の順で、資金に応じて選ぶ。 */
function decideAction(s: ReturnType<typeof useGameStore.getState>): void {
  const me = s.players[s.currentPlayerIndex];
  const a = s.actionAt(me.id);
  if (a.canBuild) {
    s.buildBranch();
  } else if (a.canUpgrade && Math.random() < 0.6) {
    s.upgradeBranch();
  } else if (a.canDevelop && Math.random() < 0.4) {
    s.developCity();
  }
}
