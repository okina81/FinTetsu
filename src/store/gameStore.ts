import { create } from 'zustand';
import type { Branch, GamePhase, InterbankLoan, Player } from '@/game/types';
import { reachableDestinations, type MoveOption } from '@/game/pathfind';
import { CITY_BY_ID, CITIES } from '@/game/mapData';
import { PLAYER_COLORS, CITY_TYPE_LABEL } from '@/game/theme';
import { CITY_TYPE_INFO } from '@/game/cityType';
import type { CityType } from '@/game/types';
import {
  BRANCH_SPECS,
  MAX_BRANCH_LEVEL,
  branchValue,
  upgradeCost,
} from '@/game/branchSpec';
import { drawEventCard, type EventCard } from '@/game/eventCards';
import { storage } from '@/lib/persist';

/** 到着時にイベントカードを引く確率（手数料を払うマスを除く）。 */
const EVENT_CHANCE = 0.4;

/** セーブデータの localStorage キーと、保存する状態のスナップショット型。 */
const SAVE_KEY = 'fintetsu:save';
type SavedGame = {
  turn: number;
  players: Player[];
  currentPlayerIndex: number;
  branches: Record<string, Branch>;
  economy: EconomyLevel;
  develop: Record<string, number>;
  loans: InterbankLoan[];
};

/** インターバンク融資の 1 ラウンド金利（6%）。借り換えで雪だるま式に膨らむ。 */
const INTERBANK_RATE = 0.06;
/** 自己資本比率の規制ライン（BIS 規制のもじり：8%）。下回ると危険水域。 */
export const CAPITAL_FLOOR = 0.08;

let loanSeq = 0;
const nextLoanId = (): string => `L${++loanSeq}`;

/** プレイヤーが他行から借りている総額（負債）。 */
function borrowedOf(loans: InterbankLoan[], id: string): number {
  return loans.reduce((s, l) => (l.debtorId === id ? s + l.principal : s), 0);
}
/** プレイヤーが他行へ貸している総額（債権＝資産）。 */
function lentOf(loans: InterbankLoan[], id: string): number {
  return loans.reduce((s, l) => (l.creditorId === id ? s + l.principal : s), 0);
}
/** プレイヤーが保有する支店の評価額合計。 */
function branchEquity(
  player: Player,
  branches: Record<string, Branch>,
): number {
  let v = 0;
  for (const cid in branches) {
    if (branches[cid].ownerId === player.id)
      v += branchValue(branches[cid].level);
  }
  return v;
}
/** 純資産 = 現金 + 支店評価額 + 貸付債権 − 借入負債。 */
function netWorth(
  player: Player,
  branches: Record<string, Branch>,
  loans: InterbankLoan[],
): number {
  return (
    player.cash +
    branchEquity(player, branches) +
    lentOf(loans, player.id) -
    borrowedOf(loans, player.id)
  );
}
/** 総資産（自己資本比率の分母）＝純資産 + 借入負債 = 現金 + 支店 + 貸付。 */
function grossAssets(
  player: Player,
  branches: Record<string, Branch>,
  loans: InterbankLoan[],
): number {
  return (
    player.cash + branchEquity(player, branches) + lentOf(loans, player.id)
  );
}

/** 自己資本比率（0〜1）。総資産ゼロなら 1 とみなす。 */
export function capitalRatioOf(
  player: Player,
  branches: Record<string, Branch>,
  loans: InterbankLoan[],
): number {
  const gross = grossAssets(player, branches, loans);
  if (gross <= 0) return player.bankrupt ? 0 : 1;
  return netWorth(player, branches, loans) / gross;
}

/** 自己資本比率から信用格付けを返す（破綻は D）。 */
export function ratingOf(ratio: number, bankrupt: boolean): string {
  if (bankrupt) return 'D';
  if (ratio >= 0.6) return 'AAA';
  if (ratio >= 0.45) return 'AA';
  if (ratio >= 0.3) return 'A';
  if (ratio >= CAPITAL_FLOOR) return 'BBB';
  if (ratio >= 0.03) return 'BB';
  if (ratio > 0) return 'B';
  return 'CCC';
}

/**
 * 債務者 debtorId の現金不足（cash < 0）を、健全な他行からの自動借入で埋める。
 * 各貸し手の手元現金に比例して融資が割り当てられ、債権者→債務者のローンが張られる。
 * プールが不足すれば埋めきれず、債務者は現金マイナスのまま（→ resolveDefaults で破綻）。
 */
function coverShortfall(
  players: Player[],
  debtorId: string,
  loans: InterbankLoan[],
): { players: Player[]; loans: InterbankLoan[]; borrowed: number } {
  const debtor = players.find((p) => p.id === debtorId);
  if (!debtor || debtor.cash >= 0) return { players, loans, borrowed: 0 };
  const deficit = -debtor.cash;
  const lenders = players.filter(
    (p) => p.id !== debtorId && !p.bankrupt && p.cash > 0,
  );
  const pool = lenders.reduce((s, p) => s + p.cash, 0);
  if (pool <= 0) return { players, loans, borrowed: 0 };

  const raise = Math.min(deficit, pool);
  const lentBy: Record<string, number> = {};
  let remaining = raise;
  // 手元現金に比例して配分（端数は最後に貪欲で詰める）。
  for (const p of lenders) {
    if (remaining <= 0) break;
    const want = Math.round(raise * (p.cash / pool));
    const amt = Math.min(want, p.cash, remaining);
    if (amt > 0) {
      lentBy[p.id] = (lentBy[p.id] ?? 0) + amt;
      remaining -= amt;
    }
  }
  // 比例配分の端数で埋め残しがあれば、余力のある貸し手から順に詰める。
  if (remaining > 0) {
    for (const p of lenders) {
      if (remaining <= 0) break;
      const room = p.cash - (lentBy[p.id] ?? 0);
      const amt = Math.min(room, remaining);
      if (amt > 0) {
        lentBy[p.id] = (lentBy[p.id] ?? 0) + amt;
        remaining -= amt;
      }
    }
  }

  const newLoans = [...loans];
  for (const cid in lentBy) {
    newLoans.push({
      id: nextLoanId(),
      creditorId: cid,
      debtorId,
      principal: lentBy[cid],
    });
  }
  const raised = raise - remaining;
  const players2 = players.map((p) => {
    if (p.id === debtorId) return { ...p, cash: p.cash + raised };
    if (lentBy[p.id]) return { ...p, cash: p.cash - lentBy[p.id] };
    return p;
  });
  return { players: players2, loans: newLoans, borrowed: raised };
}

/**
 * デフォルト（破綻）連鎖を不動点まで解決する。
 * 「現金マイナスで埋められない」または「純資産マイナス（債務超過）」の行を破綻させ、
 * その行に絡む全ローンを消滅させる。破綻行へ貸していた債権者は債権（資産）を失うため、
 * それで純資産がマイナスに転じれば次の行も破綻する＝連鎖。
 */
function resolveDefaults(
  players: Player[],
  branches: Record<string, Branch>,
  loans: InterbankLoan[],
): {
  players: Player[];
  branches: Record<string, Branch>;
  loans: InterbankLoan[];
  failed: string[];
} {
  let ps = players;
  let br = branches;
  let ln = loans;
  const failed: string[] = [];

  for (;;) {
    const victim = ps.find(
      (p) => !p.bankrupt && (p.cash < 0 || netWorth(p, br, ln) < 0),
    );
    if (!victim) break;
    failed.push(victim.id);
    // 破綻：手元現金は消し、支店は接収（評価額は毀損）、絡むローンは消滅。
    ps = ps.map((p) =>
      p.id === victim.id ? { ...p, bankrupt: true, cash: 0 } : p,
    );
    br = Object.fromEntries(
      Object.entries(br).filter(([, b]) => b.ownerId !== victim.id),
    );
    ln = ln.filter(
      (l) => l.creditorId !== victim.id && l.debtorId !== victim.id,
    );
  }
  return { players: ps, branches: br, loans: ln, failed };
}

/**
 * 実装設計書 5 / Step 5–7。
 * ゲーム状態（Zustand）と、サイコロ→移動→支店経済→勝敗のループ。
 *
 * Phaser（PieceLayer）と React（HUD・ボタン・結果表示）は同一のこのストアを
 * 購読する。CPU の自動操作は useCpuController（React 側）が駆動する。
 */

const MAX_TURN = 100;
// 350駅規模では1物件あたりの比重が小さいため、序盤の機動力を上げる（500万）
const START_CASH = 5_000_000;
const VICTORY_ASSETS = 100_000_000; // 特殊勝利：総資産1億円

/** 地域育成「産業育成」1 回の費用（100万）。 */
const DEVELOP_COST = 1_000_000;
/** 産業育成 1 段ごとの収益ブースト（+15%）。 */
const DEVELOP_BONUS = 0.15;

export type EconomyLevel = 1 | 2 | 3 | 4 | 5;

/** 景気レベルごとの収益倍率（設計書 6-2：不況 -20% / 普通 / 好況 +20%）。 */
export function economyMultiplier(economy: EconomyLevel): number {
  if (economy <= 2) return 0.8;
  if (economy >= 4) return 1.2;
  return 1.0;
}

export function economyLabel(economy: EconomyLevel): string {
  if (economy <= 2) return '不況';
  if (economy >= 4) return '好況';
  return '普通';
}

const clampEconomy = (n: number): EconomyLevel =>
  Math.max(1, Math.min(5, n)) as EconomyLevel;

/** プレイヤー初期配置（人間1 + CPU3）。開始都市は散らす。 */
const PLAYER_SEED: Array<Pick<Player, 'id' | 'name' | 'isCpu' | 'position'>> = [
  { id: 'p1', name: 'あなた', isCpu: false, position: 'tokyo' },
  { id: 'p2', name: 'CPU銀行A', isCpu: true, position: 'osaka' },
  { id: 'p3', name: 'CPU銀行B', isCpu: true, position: 'fukuoka' },
  { id: 'p4', name: 'CPU銀行C', isCpu: true, position: 'sapporo' },
];

function makePlayers(): Player[] {
  return PLAYER_SEED.map((seed, i) => ({
    ...seed,
    color: PLAYER_COLORS[i],
    cash: START_CASH,
    debt: 0,
    bankrupt: false,
  }));
}

/**
 * プレイヤーの総資産（純資産）= 現金 + 支店評価額 + 貸付債権 − 借入負債。
 * インターバンク融資（loans）の貸借をネットして評価する。
 */
function assetsOf(
  player: Player,
  branches: Record<string, Branch>,
  loans: InterbankLoan[],
): number {
  return netWorth(player, branches, loans);
}

/**
 * 1 支店のターン収益（都市タイプ・景気・地域育成を反映）。
 * 収益 = 基本収益 × タイプ倍率 × 景気倍率 × (1 + 育成段数 × ボーナス)。
 */
function branchRevenue(
  level: 1 | 2 | 3 | 4 | 5,
  economy: EconomyLevel,
  developLevel: number,
  cityType: CityType,
): number {
  const base = BRANCH_SPECS[level].revenue;
  const mult =
    CITY_TYPE_INFO[cityType].revenueMult *
    economyMultiplier(economy) *
    (1 + developLevel * DEVELOP_BONUS);
  return Math.round(base * mult);
}

/** 都市タイプ補正を反映した支店設立費（過疎地域は安い）。 */
function buildCostFor(cityType: CityType): number {
  return Math.round(BRANCH_SPECS[1].cost * CITY_TYPE_INFO[cityType].buildMult);
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
  /** 景気レベル（1 不況 〜 5 好況）。収益に影響。 */
  economy: EconomyLevel;
  /** 都市 id -> 地域育成（産業育成）の段数。収益ブースト。 */
  develop: Record<string, number>;
  /** インターバンク融資の一覧（債権者→債務者のエッジ＝連鎖倒産の経路）。 */
  loans: InterbankLoan[];
  /** 到着時に引いたイベントカード（演出中のみ非 null）。 */
  activeCard: EventCard | null;
  /** 直近の出来事（ステータス表示用）。 */
  message: string;
  /** ゲーム終了時の勝者 id。 */
  winnerId: string | null;
  /** タイトル画面を抜けてゲームを開始したか。 */
  started: boolean;
  /** 情報ポップアップで表示中の都市 id（設計書 3-2）。 */
  inspectCityId: string | null;

  // --- アクション ---
  startGame: () => void;
  /** 都市情報ポップアップを開く / 閉じる。 */
  inspectCity: (cityId: string | null) => void;
  rollDice: () => void;
  chooseDestination: (dest: string) => void;
  completeMove: () => void;
  buildBranch: () => void;
  upgradeBranch: () => void;
  /** 現在地の自支店に地域育成（産業育成）を行う。 */
  developCity: () => void;
  /** 引いたイベントカードの効果を適用し、行動フェーズへ進む。 */
  applyEventCard: () => void;
  endTurn: () => void;
  reset: () => void;

  // --- セーブ / ロード（中断再開） ---
  /** 現在の局面を localStorage に保存する。 */
  saveGame: () => void;
  /** 保存した局面を読み込んで再開する（無ければ false）。 */
  loadGame: () => boolean;
  /** セーブデータの有無。 */
  hasSavedGame: () => boolean;
  /** セーブデータを削除する。 */
  clearSavedGame: () => void;

  // --- セレクタ ---
  currentPlayer: () => Player;
  totalAssets: (playerId: string) => number;
  /** プレイヤーの借入総額（インターバンク負債）。 */
  debtOf: (playerId: string) => number;
  /** プレイヤーの自己資本比率（0〜1）と信用格付け。 */
  capital: (playerId: string) => { ratio: number; rating: string };
  /** 現在地で人間が取れる行動（build / upgrade / develop 可否）。 */
  actionAt: (playerId: string) => {
    canBuild: boolean;
    canUpgrade: boolean;
    canDevelop: boolean;
    buildCost: number;
    upgradeCost: number;
    developCost: number;
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
  economy: 3,
  develop: {},
  loans: [],
  activeCard: null,
  message: 'サイコロを振って移動しよう',
  winnerId: null,
  started: false,
  inspectCityId: null,

  startGame: () => set({ started: true }),

  inspectCity: (cityId) => set({ inspectCityId: cityId }),

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
    set({
      pendingMove: move,
      phase: 'moving',
      options: [],
      inspectCityId: null,
    });
  },

  completeMove: () => {
    const { phase, pendingMove, players, currentPlayerIndex, branches, loans } =
      get();
    if (phase !== 'moving' || !pendingMove) return;
    const dest = pendingMove.dest;
    const me = players[currentPlayerIndex];
    const cityName = CITY_BY_ID[dest]?.name ?? dest;

    let message = `${me.name} は ${cityName} に到着`;
    let players2 = players.map((p, i) =>
      i === currentPlayerIndex ? { ...p, position: dest } : p,
    );
    let loans2 = loans;
    let branches2 = branches;

    // 他プレイヤーの支店に止まったら利用料を支払う
    const branch = branches[dest];
    const paysFee = !!branch && branch.ownerId !== me.id;
    if (paysFee && branch) {
      const fee = BRANCH_SPECS[branch.level].fee;
      players2 = players2.map((p) => {
        if (p.id === me.id) return { ...p, cash: p.cash - fee };
        if (p.id === branch.ownerId) return { ...p, cash: p.cash + fee };
        return p;
      });
      const owner = players.find((p) => p.id === branch.ownerId);
      message = `${me.name} は ${cityName} で利用料 ${formatMan(fee)} を ${owner?.name ?? ''} に支払った`;

      // 現金が尽きたらインターバンク市場から自動借入 → 連鎖倒産を判定
      const cover = coverShortfall(players2, me.id, loans2);
      players2 = cover.players;
      loans2 = cover.loans;
      if (cover.borrowed > 0) {
        message += `（不足分 ${formatMan(cover.borrowed)} を銀行間市場から借入）`;
      }
      const settled = resolveDefaults(players2, branches2, loans2);
      players2 = settled.players;
      branches2 = settled.branches;
      loans2 = settled.loans;
      if (settled.failed.length > 0) {
        const names = settled.failed
          .map((id) => players.find((p) => p.id === id)?.name ?? id)
          .join(' → ');
        message += ` 💥 ${names} が連鎖破綻！`;
      }
    }

    // 手数料マス以外では一定確率でイベントカードを引く（イベントマス相当）
    if (!paysFee && Math.random() < EVENT_CHANCE) {
      const card = drawEventCard();
      set({
        players: players2,
        loans: loans2,
        branches: branches2,
        pendingMove: null,
        phase: 'event',
        activeCard: card,
        message: `${me.name} は ${cityName} でカードを引いた`,
      });
      return;
    }

    set({
      players: players2,
      loans: loans2,
      branches: branches2,
      pendingMove: null,
      phase: 'action',
      message,
    });
  },

  applyEventCard: () => {
    const { phase, activeCard, players, currentPlayerIndex, economy, develop } =
      get();
    if (phase !== 'event' || !activeCard) return;
    const me = players[currentPlayerIndex];
    const effect = activeCard.effect;

    let players2 = players;
    let nextEconomy = economy;
    let nextDevelop = develop;
    let detail = '';

    switch (effect.kind) {
      case 'cash':
        players2 = players.map((p, i) =>
          i === currentPlayerIndex ? { ...p, cash: p.cash + effect.amount } : p,
        );
        detail = `${me.name} の現金 ${effect.amount >= 0 ? '+' : '−'}${formatMan(Math.abs(effect.amount))}`;
        break;
      case 'economy':
        nextEconomy = clampEconomy(economy + effect.delta);
        detail = `景気 → ${economyLabel(nextEconomy)}`;
        break;
      case 'cityDevelop': {
        nextDevelop = { ...develop };
        for (const city of CITIES) {
          if (city.type === effect.cityType) {
            nextDevelop[city.id] = Math.max(
              0,
              (nextDevelop[city.id] ?? 0) + effect.delta,
            );
          }
        }
        detail = `${CITY_TYPE_LABEL[effect.cityType]}の収益が${effect.delta >= 0 ? '上昇' : '低下'}`;
        break;
      }
    }

    set({
      players: players2,
      economy: nextEconomy,
      develop: nextDevelop,
      activeCard: null,
      phase: 'action',
      message: `🃏 ${activeCard.title}：${detail}`,
    });
  },

  buildBranch: () => {
    const { phase, players, currentPlayerIndex, branches } = get();
    if (phase !== 'action') return;
    const me = players[currentPlayerIndex];
    const cid = me.position;
    if (branches[cid]) return; // 既に支店がある
    const cost = buildCostFor(CITY_BY_ID[cid]?.type ?? 'tourism');
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

  developCity: () => {
    const { phase, players, currentPlayerIndex, branches, develop } = get();
    if (phase !== 'action') return;
    const me = players[currentPlayerIndex];
    const cid = me.position;
    const b = branches[cid];
    if (!b || b.ownerId !== me.id) return; // 自支店のある都市のみ育成可
    if (me.cash < DEVELOP_COST) return;
    const cityName = CITY_BY_ID[cid]?.name ?? cid;
    set({
      players: players.map((p, i) =>
        i === currentPlayerIndex ? { ...p, cash: p.cash - DEVELOP_COST } : p,
      ),
      develop: { ...develop, [cid]: (develop[cid] ?? 0) + 1 },
      message: `${me.name} は ${cityName} の産業を育成（${formatMan(DEVELOP_COST)}）→ 収益UP`,
    });
  },

  endTurn: () => {
    const {
      phase,
      players,
      currentPlayerIndex,
      branches,
      turn,
      economy,
      develop,
      loans,
    } = get();
    if (phase !== 'action') return;
    const me = players[currentPlayerIndex];

    // 収益：自分の全支店の収益を回収（景気・地域育成を反映）
    let revenue = 0;
    for (const cid in branches) {
      if (branches[cid].ownerId === me.id) {
        revenue += branchRevenue(
          branches[cid].level,
          economy,
          develop[cid] ?? 0,
          CITY_BY_ID[cid]?.type ?? 'tourism',
        );
      }
    }
    let players2 = players.map((p, i) =>
      i === currentPlayerIndex ? { ...p, cash: p.cash + revenue } : p,
    );
    let loans2 = loans;
    let branches2 = branches;

    // インターバンク金利：自分の借入に毎ターン利息が発生し、各債権者へ支払う。
    // 払えなければ借り換え（自動借入）で雪だるま化し、いずれデフォルトへ。
    const myLoans = loans.filter((l) => l.debtorId === me.id);
    let interestPaid = 0;
    if (myLoans.length > 0) {
      const perCreditor: Record<string, number> = {};
      for (const l of myLoans) {
        const amt = Math.round(l.principal * INTERBANK_RATE);
        perCreditor[l.creditorId] = (perCreditor[l.creditorId] ?? 0) + amt;
        interestPaid += amt;
      }
      players2 = players2.map((p) => {
        if (p.id === me.id) return { ...p, cash: p.cash - interestPaid };
        if (perCreditor[p.id])
          return { ...p, cash: p.cash + perCreditor[p.id] };
        return p;
      });
      const cover = coverShortfall(players2, me.id, loans2);
      players2 = cover.players;
      loans2 = cover.loans;
    }

    // デフォルト連鎖を解決（破綻行・支店接収・ローン消滅・伝播）
    const settled = resolveDefaults(players2, branches2, loans2);
    players2 = settled.players;
    branches2 = settled.branches;
    loans2 = settled.loans;
    const failedMsg =
      settled.failed.length > 0
        ? ` 💥 ${settled.failed
            .map((id) => players.find((p) => p.id === id)?.name ?? id)
            .join(' → ')} が破綻！`
        : '';

    // 次の手番：破綻した行は飛ばす。一周回ったらターン+1。
    const alive = players2.filter((p) => !p.bankrupt);
    let nextIndex = currentPlayerIndex;
    for (let i = 0; i < players2.length; i++) {
      nextIndex = (nextIndex + 1) % players2.length;
      if (!players2[nextIndex].bankrupt) break;
    }
    const wrapped = nextIndex <= currentPlayerIndex;
    const nextTurn = wrapped ? turn + 1 : turn;

    // 新しいラウンドの頭で景気がランダムに変動（不況↔好況）
    let nextEconomy = economy;
    if (wrapped) {
      const drift = Math.floor(Math.random() * 3) - 1; // -1 / 0 / +1
      nextEconomy = clampEconomy(economy + drift);
    }

    // 勝敗判定（純資産は loans を反映）。破綻者は対象外。
    const contenders = alive.length > 0 ? alive : players2;
    const argmax = contenders.reduce((best, p) =>
      assetsOf(p, branches2, loans2) > assetsOf(best, branches2, loans2)
        ? p
        : best,
    );
    const richReached = alive.find(
      (p) => assetsOf(p, branches2, loans2) >= VICTORY_ASSETS,
    );

    // 最後の1行だけが生き残ったら即終了（連鎖倒産による勝利）。
    if (alive.length <= 1) {
      storage.remove(SAVE_KEY);
      set({
        players: players2,
        branches: branches2,
        loans: loans2,
        phase: 'gameover',
        winnerId: alive[0]?.id ?? argmax.id,
        message: `他行がすべて破綻！ 生き残った ${alive[0]?.name ?? argmax.name} の勝利`,
      });
      return;
    }
    if (nextTurn > MAX_TURN) {
      storage.remove(SAVE_KEY);
      set({
        players: players2,
        branches: branches2,
        loans: loans2,
        phase: 'gameover',
        winnerId: argmax.id,
        message: `ゲーム終了！ 勝者は ${argmax.name}`,
      });
      return;
    }
    if (richReached) {
      storage.remove(SAVE_KEY);
      set({
        players: players2,
        branches: branches2,
        loans: loans2,
        phase: 'gameover',
        winnerId: richReached.id,
        message: `${richReached.name} が総資産1億円を達成！`,
      });
      return;
    }

    // 安定点（次プレイヤーの roll 直前）で自動セーブ
    storage.setJSON(SAVE_KEY, {
      turn: nextTurn,
      players: players2,
      currentPlayerIndex: nextIndex,
      branches: branches2,
      economy: nextEconomy,
      develop,
      loans: loans2,
    } satisfies SavedGame);

    const next = players2[nextIndex];
    const econMsg =
      nextEconomy !== economy
        ? ` ［景気${nextEconomy > economy ? '上昇' : '悪化'}→${economyLabel(nextEconomy)}］`
        : '';
    const flows: string[] = [];
    if (revenue > 0) flows.push(`収益 ${formatMan(revenue)}`);
    if (interestPaid > 0) flows.push(`利息 −${formatMan(interestPaid)}`);
    const flowMsg =
      flows.length > 0 ? `${me.name}：${flows.join(' / ')} → ` : '';
    set({
      players: players2,
      branches: branches2,
      loans: loans2,
      currentPlayerIndex: nextIndex,
      turn: nextTurn,
      economy: nextEconomy,
      dice: null,
      options: [],
      phase: 'roll',
      message: `${flowMsg}${next.name} の番${failedMsg}${econMsg}`,
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
      economy: 3,
      develop: {},
      loans: [],
      activeCard: null,
      message: 'サイコロを振って移動しよう',
      winnerId: null,
      started: true, // リプレイはタイトルを経由せず即開始
      inspectCityId: null,
    }),

  saveGame: () => {
    const {
      turn,
      players,
      currentPlayerIndex,
      branches,
      economy,
      develop,
      loans,
    } = get();
    const snapshot: SavedGame = {
      turn,
      players,
      currentPlayerIndex,
      branches,
      economy,
      develop,
      loans,
    };
    storage.setJSON(SAVE_KEY, snapshot);
    set({ message: '💾 セーブしました' });
  },

  loadGame: () => {
    const saved = storage.getJSON<SavedGame>(SAVE_KEY);
    if (!saved) return false;
    // 移動・選択・カードなどの一時状態はクリアし、安定した roll から再開
    set({
      turn: saved.turn,
      players: saved.players,
      currentPlayerIndex: saved.currentPlayerIndex,
      branches: saved.branches,
      economy: saved.economy,
      develop: saved.develop,
      loans: saved.loans ?? [],
      phase: 'roll',
      dice: null,
      options: [],
      pendingMove: null,
      activeCard: null,
      winnerId: null,
      started: true,
      message: '📂 セーブデータから再開',
    });
    return true;
  },

  hasSavedGame: () => storage.get(SAVE_KEY) != null,

  clearSavedGame: () => storage.remove(SAVE_KEY),

  currentPlayer: () => {
    const { players, currentPlayerIndex } = get();
    return players[currentPlayerIndex];
  },

  totalAssets: (playerId) => {
    const { players, branches, loans } = get();
    const p = players.find((x) => x.id === playerId);
    return p ? assetsOf(p, branches, loans) : 0;
  },

  debtOf: (playerId) => borrowedOf(get().loans, playerId),

  capital: (playerId) => {
    const { players, branches, loans } = get();
    const p = players.find((x) => x.id === playerId);
    if (!p) return { ratio: 1, rating: 'AAA' };
    const ratio = capitalRatioOf(p, branches, loans);
    return { ratio, rating: ratingOf(ratio, p.bankrupt) };
  },

  actionAt: (playerId) => {
    const { players, branches } = get();
    const p = players.find((x) => x.id === playerId);
    if (!p) {
      return {
        canBuild: false,
        canUpgrade: false,
        canDevelop: false,
        buildCost: 0,
        upgradeCost: 0,
        developCost: 0,
      };
    }
    const b = branches[p.position];
    const buildCost = buildCostFor(CITY_BY_ID[p.position]?.type ?? 'tourism');
    const upCost = b ? upgradeCost(b.level) : 0;
    const ownsHere = !!b && b.ownerId === p.id;
    return {
      canBuild: !b && p.cash >= buildCost,
      canUpgrade: ownsHere && b!.level < MAX_BRANCH_LEVEL && p.cash >= upCost,
      canDevelop: ownsHere && p.cash >= DEVELOP_COST,
      buildCost,
      upgradeCost: upCost,
      developCost: DEVELOP_COST,
    };
  },
}));

/** 円を「万」単位で表示。 */
export function formatMan(yen: number): string {
  const man = Math.round(yen / 10000);
  return `¥${man.toLocaleString('ja-JP')}万`;
}

export { MAX_TURN, VICTORY_ASSETS, START_CASH };
