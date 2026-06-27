import { create } from 'zustand';
import type { GamePhase, Player } from '@/game/types';
import { reachableDestinations, type MoveOption } from '@/game/pathfind';
import { PLAYER_COLORS } from '@/game/theme';

/**
 * 実装設計書 5 / コーディング順序 Step 5–6。
 * ゲーム状態（Zustand）とサイコロ→移動ループのアクション。
 *
 * Phaser（PieceLayer）と React（HUD・ボタン）は同一のこのストアを購読する。
 */

const START_CITY = 'tokyo';
const MAX_TURN = 100;

function makePlayers(): Player[] {
  // 現状は単独プレイ（あなた）。CPU は Step 10 で追加予定。
  return [
    {
      id: 'p1',
      name: 'あなた',
      color: PLAYER_COLORS[0],
      position: START_CITY,
      cash: 3000000, // 地方銀行スタート相当（300万）
      debt: 0,
    },
  ];
}

export type GameStore = {
  turn: number;
  phase: GamePhase;
  /** 直近のサイコロ出目（未振りは null）。 */
  dice: number | null;
  players: Player[];
  currentPlayerIndex: number;
  /** select フェーズで提示する移動先候補。 */
  options: MoveOption[];
  /** moving フェーズでアニメーション対象となる移動。 */
  pendingMove: MoveOption | null;

  // --- アクション ---
  rollDice: () => void;
  chooseDestination: (dest: string) => void;
  /** PieceLayer がアニメーション完了時に呼ぶ。 */
  completeMove: () => void;
  endTurn: () => void;
  reset: () => void;

  // --- セレクタ ---
  currentPlayer: () => Player;
};

export const useGameStore = create<GameStore>((set, get) => ({
  turn: 1,
  phase: 'roll',
  dice: null,
  players: makePlayers(),
  currentPlayerIndex: 0,
  options: [],
  pendingMove: null,

  rollDice: () => {
    const { phase, players, currentPlayerIndex } = get();
    if (phase !== 'roll') return;
    const roll = 1 + Math.floor(Math.random() * 6);
    const me = players[currentPlayerIndex];
    const options = reachableDestinations(me.position, roll);
    set({ dice: roll, options, phase: 'select' });
  },

  chooseDestination: (dest) => {
    const { phase, options } = get();
    if (phase !== 'select') return;
    const move = options.find((o) => o.dest === dest);
    if (!move) return; // ハイライト外のクリックは無視
    set({ pendingMove: move, phase: 'moving', options: [] });
  },

  completeMove: () => {
    const { phase, pendingMove, players, currentPlayerIndex } = get();
    if (phase !== 'moving' || !pendingMove) return;
    const updated = players.map((p, i) =>
      i === currentPlayerIndex ? { ...p, position: pendingMove.dest } : p,
    );
    set({ players: updated, pendingMove: null, phase: 'action' });
  },

  endTurn: () => {
    const { phase, players, currentPlayerIndex, turn } = get();
    if (phase !== 'action') return;
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    const nextTurn = nextIndex === 0 ? turn + 1 : turn;
    set({
      currentPlayerIndex: nextIndex,
      turn: Math.min(nextTurn, MAX_TURN),
      dice: null,
      options: [],
      phase: 'roll',
    });
  },

  reset: () =>
    set({
      turn: 1,
      phase: 'roll',
      dice: null,
      players: makePlayers(),
      currentPlayerIndex: 0,
      options: [],
      pendingMove: null,
    }),

  currentPlayer: () => {
    const { players, currentPlayerIndex } = get();
    return players[currentPlayerIndex];
  },
}));

export { MAX_TURN };
