import { create } from 'zustand';
import type { Branch, GamePhase, TradeCredit, Player } from '@/game/types';
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

/** 到着時にイベントカードを引く確率（取引が発生するマスを除く）。 */
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
  credits: TradeCredit[];
};

/** 買掛金（取引信用）に毎ターンかかる金利相当のコスト（6%）。膨らむと資金繰りを圧迫。 */
const TRADE_CREDIT_RATE = 0.06;
/** 自己資本比率の危険ライン（8%）。下回ると信用不安・危険水域。 */
export const CAPITAL_FLOOR = 0.08;

let creditSeq = 0;
const nextCreditId = (): string => `C${++creditSeq}`;

/** プレイヤーの買掛金（取引先に後払いで負っている代金）の総額＝負債。 */
function payablesOf(credits: TradeCredit[], id: string): number {
  return credits.reduce((s, c) => (c.buyerId === id ? s + c.amount : s), 0);
}
/** プレイヤーの売掛金（取引先から後払いで受け取る代金）の総額＝資産。 */
function receivablesOf(credits: TradeCredit[], id: string): number {
  return credits.reduce((s, c) => (c.supplierId === id ? s + c.amount : s), 0);
}
/** プレイヤーが保有する拠点（店舗）の評価額合計。 */
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
/** 純資産 = 現金 + 拠点評価額 + 売掛金 − 買掛金。 */
function netWorth(
  player: Player,
  branches: Record<string, Branch>,
  credits: TradeCredit[],
): number {
  return (
    player.cash +
    branchEquity(player, branches) +
    receivablesOf(credits, player.id) -
    payablesOf(credits, player.id)
  );
}
/** 総資産（自己資本比率の分母）＝純資産 + 買掛金 = 現金 + 拠点 + 売掛金。 */
function grossAssets(
  player: Player,
  branches: Record<string, Branch>,
  credits: TradeCredit[],
): number {
  return (
    player.cash +
    branchEquity(player, branches) +
    receivablesOf(credits, player.id)
  );
}

/** 自己資本比率（0〜1）。総資産ゼロなら 1 とみなす。 */
export function capitalRatioOf(
  player: Player,
  branches: Record<string, Branch>,
  credits: TradeCredit[],
): number {
  const gross = grossAssets(player, branches, credits);
  if (gross <= 0) return player.bankrupt ? 0 : 1;
  return netWorth(player, branches, credits) / gross;
}

/** 自己資本比率から信用格付けを返す（倒産は D）。 */
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
 * 買い手 buyer が売り手 supplier の拠点で取引（仕入れ・利用）したときの決済。
 * 手元現金で払える分はその場で支払い、足りない分は「掛け」で後払い＝買掛金になる
 * （supplier は同額の売掛金を持つ）。返り値の credit が今回生まれた買掛金。
 * この掛け取引のエッジが、後の「取引先倒産→売掛金焦げ付き」連鎖の経路になる。
 */
function settleTransaction(
  players: Player[],
  buyerId: string,
  supplierId: string,
  fee: number,
  credits: TradeCredit[],
): { players: Player[]; credits: TradeCredit[]; credit: number } {
  const buyer = players.find((p) => p.id === buyerId);
  const paidCash = Math.min(fee, Math.max(0, buyer?.cash ?? 0));
  const credit = fee - paidCash;
  const players2 = players.map((p) => {
    if (p.id === buyerId) return { ...p, cash: p.cash - paidCash };
    if (p.id === supplierId) return { ...p, cash: p.cash + paidCash };
    return p;
  });
  const credits2 =
    credit > 0
      ? [
          ...credits,
          { id: nextCreditId(), supplierId, buyerId, amount: credit },
        ]
      : credits;
  return { players: players2, credits: credits2, credit };
}

/**
 * 連鎖倒産を不動点まで解決する。
 * 「現金マイナス（資金繰り倒産）」または「純資産マイナス（債務超過）」の会社を倒産させ、
 * その会社に絡む全取引信用を消滅させる。倒産した取引先に売掛金を持っていた会社は
 * その債権（資産）を失うため、それで純資産がマイナスに転じれば次の会社も倒産する＝連鎖。
 */
function resolveDefaults(
  players: Player[],
  branches: Record<string, Branch>,
  credits: TradeCredit[],
): {
  players: Player[];
  branches: Record<string, Branch>;
  credits: TradeCredit[];
  failed: string[];
} {
  let ps = players;
  let br = branches;
  let cr = credits;
  const failed: string[] = [];

  for (;;) {
    const victim = ps.find(
      (p) => !p.bankrupt && (p.cash < 0 || netWorth(p, br, cr) < 0),
    );
    if (!victim) break;
    failed.push(victim.id);
    // 倒産：手元現金は消し、拠点は失われ（評価額は毀損）、絡む取引信用は消滅。
    ps = ps.map((p) =>
      p.id === victim.id ? { ...p, bankrupt: true, cash: 0 } : p,
    );
    br = Object.fromEntries(
      Object.entries(br).filter(([, b]) => b.ownerId !== victim.id),
    );
    cr = cr.filter(
      (c) => c.supplierId !== victim.id && c.buyerId !== victim.id,
    );
  }
  return { players: ps, branches: br, credits: cr, failed };
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
  { id: 'p2', name: 'ライバル社A', isCpu: true, position: 'osaka' },
  { id: 'p3', name: 'ライバル社B', isCpu: true, position: 'fukuoka' },
  { id: 'p4', name: 'ライバル社C', isCpu: true, position: 'sapporo' },
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
 * プレイヤーの総資産（純資産）= 現金 + 拠点評価額 + 売掛金 − 買掛金。
 * 取引信用（credits）の売掛・買掛をネットして評価する。
 */
function assetsOf(
  player: Player,
  branches: Record<string, Branch>,
  credits: TradeCredit[],
): number {
  return netWorth(player, branches, credits);
}

/**
 * 1 拠点のターン収益（都市タイプ・景気・地域育成を反映）。
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

/** 都市タイプ補正を反映した出店費（過疎地域は安い）。 */
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
  /** 都市 id -> 拠点。未出店は未登録。 */
  branches: Record<string, Branch>;
  /** 景気レベル（1 不況 〜 5 好況）。収益に影響。 */
  economy: EconomyLevel;
  /** 都市 id -> 地域育成（産業育成）の段数。収益ブースト。 */
  develop: Record<string, number>;
  /** 取引信用（売掛/買掛）の一覧（売り手→買い手のエッジ＝連鎖倒産の経路）。 */
  credits: TradeCredit[];
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
  /** 現在地の自社拠点で地域育成（産業育成）を行う。 */
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
  /** プレイヤーの買掛金（取引信用の負債）の総額。 */
  payableOf: (playerId: string) => number;
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
  credits: [],
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
    const {
      phase,
      pendingMove,
      players,
      currentPlayerIndex,
      branches,
      credits,
    } = get();
    if (phase !== 'moving' || !pendingMove) return;
    const dest = pendingMove.dest;
    const me = players[currentPlayerIndex];
    const cityName = CITY_BY_ID[dest]?.name ?? dest;

    let message = `${me.name} は ${cityName} に到着`;
    let players2 = players.map((p, i) =>
      i === currentPlayerIndex ? { ...p, position: dest } : p,
    );
    let credits2 = credits;
    let branches2 = branches;

    // 他社の拠点に止まったら取引（仕入れ・利用）が発生し、代金を支払う
    const branch = branches[dest];
    const paysFee = !!branch && branch.ownerId !== me.id;
    if (paysFee && branch) {
      const fee = BRANCH_SPECS[branch.level].fee;
      const owner = players.find((p) => p.id === branch.ownerId);
      // 現金で払える分は即支払い、足りない分は買掛金（後払い）になる
      const tx = settleTransaction(
        players2,
        me.id,
        branch.ownerId,
        fee,
        credits2,
      );
      players2 = tx.players;
      credits2 = tx.credits;
      message = `${me.name} は ${cityName} で ${owner?.name ?? ''} と取引、${formatMan(fee)} を支払い（仕入れ）`;
      if (tx.credit > 0) {
        message += `（うち ${formatMan(tx.credit)} は買掛金）`;
      }

      // 取引で純資産が割れた会社があれば倒産 → 取引信用をたどって連鎖を判定
      const settled = resolveDefaults(players2, branches2, credits2);
      players2 = settled.players;
      branches2 = settled.branches;
      credits2 = settled.credits;
      if (settled.failed.length > 0) {
        const names = settled.failed
          .map((id) => players.find((p) => p.id === id)?.name ?? id)
          .join(' → ');
        message += ` 💥 ${names} が連鎖倒産！`;
      }
    }

    // 取引マス以外では一定確率でイベントカードを引く（イベントマス相当）
    if (!paysFee && Math.random() < EVENT_CHANCE) {
      const card = drawEventCard();
      set({
        players: players2,
        credits: credits2,
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
      credits: credits2,
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
      credits,
    } = get();
    if (phase !== 'action') return;
    const me = players[currentPlayerIndex];

    // 収益：自分の全拠点の収益を回収（景気・地域育成を反映）
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
    let credits2 = credits;
    let branches2 = branches;

    // 買掛金の金利相当コスト：自分の買掛金に毎ターン費用が発生し、各仕入先へ支払う。
    // 払いきれなければ資金繰りが行き詰まり（現金マイナス）、倒産判定にかかる。
    const myPayables = credits.filter((c) => c.buyerId === me.id);
    let interestPaid = 0;
    if (myPayables.length > 0) {
      const perSupplier: Record<string, number> = {};
      for (const c of myPayables) {
        const amt = Math.round(c.amount * TRADE_CREDIT_RATE);
        perSupplier[c.supplierId] = (perSupplier[c.supplierId] ?? 0) + amt;
        interestPaid += amt;
      }
      const canPay = me.cash >= interestPaid;
      players2 = players2.map((p) => {
        if (p.id === me.id) return { ...p, cash: p.cash - interestPaid };
        // 払える場合のみ仕入先へ入金（払えない＝資金繰り倒産で債権は連鎖で焦げ付く）
        if (canPay && perSupplier[p.id])
          return { ...p, cash: p.cash + perSupplier[p.id] };
        return p;
      });
    }

    // 連鎖倒産を解決（倒産・拠点喪失・取引信用の消滅・伝播）
    const settled = resolveDefaults(players2, branches2, credits2);
    players2 = settled.players;
    branches2 = settled.branches;
    credits2 = settled.credits;
    const failedMsg =
      settled.failed.length > 0
        ? ` 💥 ${settled.failed
            .map((id) => players.find((p) => p.id === id)?.name ?? id)
            .join(' → ')} が倒産！`
        : '';

    // 次の手番：倒産した会社は飛ばす。一周回ったらターン+1。
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

    // 勝敗判定（純資産は credits を反映）。倒産者は対象外。
    const contenders = alive.length > 0 ? alive : players2;
    const argmax = contenders.reduce((best, p) =>
      assetsOf(p, branches2, credits2) > assetsOf(best, branches2, credits2)
        ? p
        : best,
    );
    const richReached = alive.find(
      (p) => assetsOf(p, branches2, credits2) >= VICTORY_ASSETS,
    );

    // 自分以外の全社が倒産したら即終了（連鎖倒産による勝利）。
    if (alive.length <= 1) {
      storage.remove(SAVE_KEY);
      set({
        players: players2,
        branches: branches2,
        credits: credits2,
        phase: 'gameover',
        winnerId: alive[0]?.id ?? argmax.id,
        message: `ライバルが全社倒産！ 生き残った ${alive[0]?.name ?? argmax.name} の勝利`,
      });
      return;
    }
    if (nextTurn > MAX_TURN) {
      storage.remove(SAVE_KEY);
      set({
        players: players2,
        branches: branches2,
        credits: credits2,
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
        credits: credits2,
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
      credits: credits2,
    } satisfies SavedGame);

    const next = players2[nextIndex];
    const econMsg =
      nextEconomy !== economy
        ? ` ［景気${nextEconomy > economy ? '上昇' : '悪化'}→${economyLabel(nextEconomy)}］`
        : '';
    const flows: string[] = [];
    if (revenue > 0) flows.push(`収益 ${formatMan(revenue)}`);
    if (interestPaid > 0) flows.push(`買掛金利息 −${formatMan(interestPaid)}`);
    const flowMsg =
      flows.length > 0 ? `${me.name}：${flows.join(' / ')} → ` : '';
    set({
      players: players2,
      branches: branches2,
      credits: credits2,
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
      credits: [],
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
      credits,
    } = get();
    const snapshot: SavedGame = {
      turn,
      players,
      currentPlayerIndex,
      branches,
      economy,
      develop,
      credits,
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
      credits: saved.credits ?? [],
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
    const { players, branches, credits } = get();
    const p = players.find((x) => x.id === playerId);
    return p ? assetsOf(p, branches, credits) : 0;
  },

  payableOf: (playerId) => payablesOf(get().credits, playerId),

  capital: (playerId) => {
    const { players, branches, credits } = get();
    const p = players.find((x) => x.id === playerId);
    if (!p) return { ratio: 1, rating: 'AAA' };
    const ratio = capitalRatioOf(p, branches, credits);
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
