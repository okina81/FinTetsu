import { create } from 'zustand';
import type { Branch, GamePhase, Player } from '@/game/types';
import { reachableDestinations, type MoveOption } from '@/game/pathfind';
import { CITY_BY_ID } from '@/game/mapData';
import { PLAYER_COLORS } from '@/game/theme';
import {
  BRANCH_SPECS,
  MAX_BRANCH_LEVEL,
  branchValue,
  upgradeCost,
} from '@/game/branchSpec';

/**
 * 実装設計書 5 / Step 5–7。
 * ゲーム状態（Zustand）と、サイコロ→移動→支店経済→勝敗のループ。
 *
 * Phaser（PieceLayer）と React（HUD・ボタン・結果表示）は同一のこのストアを
 * 購読する。CPU の自動操作は useCpuController（React 側）が駆動する。
 */

const MAX_TURN = 100;
const START_CASH = 3_000_000; // 地方銀行スタート（300万）
const VICTORY_ASSETS = 100_000_000; // 特殊勝利：総資産1億円

/** プレイヤー初期配置（人間1 + CPU3）。開始都市は散らす。 */
const PLAYER_SEED: Array<Pick<Player, 'id' | 'name' | 'isCpu' | 'position'>> = [
  { id: 'p1', name: 'あなた', isCpu: false, position: 'tokyo' },
  { id: 'p2', name: 'CPU銀行A', isCpu: true, position: 'osaka' },
  { id: 'p3', name: 'CPU銀行B', isCpu: true, position: 'fukuoka' },
  { id: 'p4', name: 'CPU銀行C', isCpu: true, position: 'sendai' },
];

function makePlayers(): Player[] {
  return PLAYER_SEED.map((seed, i) => ({
    ...seed,
    color: PLAYER_COLORS[i],
    cash: START_CASH,
    debt: 0,
  }));
}

/** プレイヤーの総資産 = 現金 − 借入 + 支店評価額。 */
function assetsOf(player: Player, branches: Record<string, Branch>): number {
  let value = player.cash - player.debt;
  for (const cid in branches) {
    const b = branches[cid];
    if (b.ownerId === player.id) value += branchValue(b.level);
  }
  return value;
}

export type GameStore = {
  turn: number;
  phase: GamePhase;
  dice: number | null;
  players: Player[];
  currentPlayerIndex: number;
  options: MoveOption[];
  pendingMove: MoveOption | null;
  /** 都市 id -> 支店。未所有は未登録。 */
  branches: Record<string, Branch>;
  /** 直近の出来事（ステータス表示用）。 */
  message: string;
  /** ゲーム終了時の勝者 id。 */
  winnerId: string | null;

  // --- アクション ---
  rollDice: () => void;
  chooseDestination: (dest: string) => void;
  completeMove: () => void;
  buildBranch: () => void;
  upgradeBranch: () => void;
  endTurn: () => void;
  reset: () => void;

  // --- セレクタ ---
  currentPlayer: () => Player;
  totalAssets: (playerId: string) => number;
  /** 現在地で人間が取れる行動（build / upgrade 可否）。 */
  actionAt: (playerId: string) => {
    canBuild: boolean;
    canUpgrade: boolean;
    buildCost: number;
    upgradeCost: number;
  };
};

export const useGameStore = create<GameStore>((set, get) => ({
  turn: 1,
  phase: 'roll',
  dice: null,
  players: makePlayers(),
  currentPlayerIndex: 0,
  options: [],
  pendingMove: null,
  branches: {},
  message: 'サイコロを振って移動しよう',
  winnerId: null,

  rollDice: () => {
    const { phase, players, currentPlayerIndex } = get();
    if (phase !== 'roll') return;
    const roll = 1 + Math.floor(Math.random() * 6);
    const me = players[currentPlayerIndex];
    const options = reachableDestinations(me.position, roll);
    set({
      dice: roll,
      options,
      phase: 'select',
      message: `${me.name}：${roll} が出た！移動先を選択`,
    });
  },

  chooseDestination: (dest) => {
    const { phase, options } = get();
    if (phase !== 'select') return;
    const move = options.find((o) => o.dest === dest);
    if (!move) return;
    set({ pendingMove: move, phase: 'moving', options: [] });
  },

  completeMove: () => {
    const { phase, pendingMove, players, currentPlayerIndex, branches } = get();
    if (phase !== 'moving' || !pendingMove) return;
    const dest = pendingMove.dest;
    const me = players[currentPlayerIndex];
    const cityName = CITY_BY_ID[dest]?.name ?? dest;

    let message = `${me.name} は ${cityName} に到着`;
    let players2 = players.map((p, i) =>
      i === currentPlayerIndex ? { ...p, position: dest } : p,
    );

    // 他プレイヤーの支店に止まったら利用料を支払う
    const branch = branches[dest];
    if (branch && branch.ownerId !== me.id) {
      const fee = BRANCH_SPECS[branch.level].fee;
      players2 = players2.map((p) => {
        if (p.id === me.id) return { ...p, cash: p.cash - fee };
        if (p.id === branch.ownerId) return { ...p, cash: p.cash + fee };
        return p;
      });
      const owner = players.find((p) => p.id === branch.ownerId);
      message = `${me.name} は ${cityName} で利用料 ${formatMan(fee)} を ${owner?.name ?? ''} に支払った`;
    }

    set({ players: players2, pendingMove: null, phase: 'action', message });
  },

  buildBranch: () => {
    const { phase, players, currentPlayerIndex, branches } = get();
    if (phase !== 'action') return;
    const me = players[currentPlayerIndex];
    const cid = me.position;
    if (branches[cid]) return; // 既に支店がある
    const cost = BRANCH_SPECS[1].cost;
    if (me.cash < cost) return;
    const cityName = CITY_BY_ID[cid]?.name ?? cid;
    set({
      players: players.map((p, i) =>
        i === currentPlayerIndex ? { ...p, cash: p.cash - cost } : p,
      ),
      branches: { ...branches, [cid]: { ownerId: me.id, level: 1 } },
      message: `${me.name} は ${cityName} に ${BRANCH_SPECS[1].name}（${formatMan(cost)}）を設立`,
    });
  },

  upgradeBranch: () => {
    const { phase, players, currentPlayerIndex, branches } = get();
    if (phase !== 'action') return;
    const me = players[currentPlayerIndex];
    const cid = me.position;
    const b = branches[cid];
    if (!b || b.ownerId !== me.id || b.level >= MAX_BRANCH_LEVEL) return;
    const cost = upgradeCost(b.level);
    if (me.cash < cost) return;
    const nextLevel = (b.level + 1) as 2 | 3 | 4 | 5;
    const cityName = CITY_BY_ID[cid]?.name ?? cid;
    set({
      players: players.map((p, i) =>
        i === currentPlayerIndex ? { ...p, cash: p.cash - cost } : p,
      ),
      branches: { ...branches, [cid]: { ownerId: me.id, level: nextLevel } },
      message: `${me.name} は ${cityName} を ${BRANCH_SPECS[nextLevel].name}（${formatMan(cost)}）に強化`,
    });
  },

  endTurn: () => {
    const { phase, players, currentPlayerIndex, branches, turn } = get();
    if (phase !== 'action') return;
    const me = players[currentPlayerIndex];

    // 収益：自分の全支店の収益を回収
    let revenue = 0;
    for (const cid in branches) {
      if (branches[cid].ownerId === me.id) {
        revenue += BRANCH_SPECS[branches[cid].level].revenue;
      }
    }
    const players2 = players.map((p, i) =>
      i === currentPlayerIndex ? { ...p, cash: p.cash + revenue } : p,
    );

    const nextIndex = (currentPlayerIndex + 1) % players2.length;
    const nextTurn = nextIndex === 0 ? turn + 1 : turn;

    // 勝敗判定
    const argmax = players2.reduce((best, p) =>
      assetsOf(p, branches) > assetsOf(best, branches) ? p : best,
    );
    const richReached = players2.find(
      (p) => assetsOf(p, branches) >= VICTORY_ASSETS,
    );

    if (nextTurn > MAX_TURN) {
      set({
        players: players2,
        phase: 'gameover',
        winnerId: argmax.id,
        message: `ゲーム終了！ 勝者は ${argmax.name}`,
      });
      return;
    }
    if (richReached) {
      set({
        players: players2,
        phase: 'gameover',
        winnerId: richReached.id,
        message: `${richReached.name} が総資産1億円を達成！`,
      });
      return;
    }

    const next = players2[nextIndex];
    set({
      players: players2,
      currentPlayerIndex: nextIndex,
      turn: nextTurn,
      dice: null,
      options: [],
      phase: 'roll',
      message:
        revenue > 0
          ? `${me.name} は収益 ${formatMan(revenue)} を獲得 → ${next.name} の番`
          : `${next.name} の番`,
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
      branches: {},
      message: 'サイコロを振って移動しよう',
      winnerId: null,
    }),

  currentPlayer: () => {
    const { players, currentPlayerIndex } = get();
    return players[currentPlayerIndex];
  },

  totalAssets: (playerId) => {
    const { players, branches } = get();
    const p = players.find((x) => x.id === playerId);
    return p ? assetsOf(p, branches) : 0;
  },

  actionAt: (playerId) => {
    const { players, branches } = get();
    const p = players.find((x) => x.id === playerId);
    if (!p) {
      return {
        canBuild: false,
        canUpgrade: false,
        buildCost: 0,
        upgradeCost: 0,
      };
    }
    const b = branches[p.position];
    const buildCost = BRANCH_SPECS[1].cost;
    const upCost = b ? upgradeCost(b.level) : 0;
    return {
      canBuild: !b && p.cash >= buildCost,
      canUpgrade:
        !!b &&
        b.ownerId === p.id &&
        b.level < MAX_BRANCH_LEVEL &&
        p.cash >= upCost,
      buildCost,
      upgradeCost: upCost,
    };
  },
}));

/** 円を「万」単位で表示。 */
export function formatMan(yen: number): string {
  const man = Math.round(yen / 10000);
  return `¥${man.toLocaleString('ja-JP')}万`;
}

export { MAX_TURN, VICTORY_ASSETS };
