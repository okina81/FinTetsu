import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useGameStore,
  MAX_TURN,
  START_CASH,
  CAPITAL_FLOOR,
  economyMultiplier,
} from './gameStore';
import { BRANCH_SPECS } from '@/game/branchSpec';
import { EVENT_DECK } from '@/game/eventCards';
import { CITIES } from '@/game/mapData';
import { CITY_TYPE_INFO } from '@/game/cityType';

/** osaka は金融都市（収益倍率）。テストの期待値計算に使う。 */
const OSAKA_MULT = CITY_TYPE_INFO.financial.revenueMult;

const s = () => useGameStore.getState();

describe('gameStore — ループ基本', () => {
  beforeEach(() => s().reset());
  afterEach(() => vi.restoreAllMocks());

  it('初期状態：4人・人間先攻・tokyo 開始', () => {
    expect(s().players).toHaveLength(4);
    expect(s().players[0].isCpu).toBe(false);
    expect(s().players[0].position).toBe('tokyo');
    expect(s().turn).toBe(1);
    expect(s().phase).toBe('roll');
  });

  it('startGame で started が true になる', () => {
    useGameStore.setState({ started: false });
    s().startGame();
    expect(s().started).toBe(true);
  });

  it('rollDice は出目と候補を出し select へ', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 出目 4
    s().rollDice();
    expect(s().dice).toBe(4);
    expect(s().phase).toBe('select');
    expect(s().options.length).toBeGreaterThan(0);
  });

  it('completeMove で現在地更新 → action フェーズ', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 出目 4 / イベント非発生
    s().rollDice();
    const dest = s().options[0].dest;
    s().chooseDestination(dest);
    s().completeMove();
    expect(s().players[0].position).toBe(dest);
    expect(s().phase).toBe('action');
  });

  it('endTurn は次プレイヤーへ（4人なので turn は据え置き）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // イベント非発生
    s().rollDice();
    s().chooseDestination(s().options[0].dest);
    s().completeMove();
    s().endTurn();
    expect(s().currentPlayerIndex).toBe(1);
    expect(s().turn).toBe(1);
    expect(s().phase).toBe('roll');
  });
});

describe('gameStore — 支店経済', () => {
  beforeEach(() => s().reset());
  afterEach(() => vi.restoreAllMocks());

  it('未所有都市に支店を設立すると現金が減り所有権が付く', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // 出目 4 / イベント非発生
    const cashBefore = s().players[0].cash;
    s().rollDice();
    const dest = s().options[0].dest;
    s().chooseDestination(dest);
    s().completeMove();
    // 設立費は都市タイプ補正（過疎地域は割引）を受けるため、実費を捕捉する
    const buildCost = s().actionAt('p1').buildCost;
    s().buildBranch();
    expect(s().branches[dest]).toEqual({ ownerId: 'p1', level: 1 });
    expect(s().players[0].cash).toBe(cashBefore - buildCost);
  });

  it('自分の支店は強化でき、レベルが上がる', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // イベント非発生
    s().rollDice();
    const dest = s().options[0].dest;
    s().chooseDestination(dest);
    s().completeMove();
    s().buildBranch();
    const cash1 = s().players[0].cash;
    s().upgradeBranch();
    expect(s().branches[dest].level).toBe(2);
    expect(s().players[0].cash).toBe(cash1 - BRANCH_SPECS[2].cost);
  });

  it('他人の支店に止まると利用料が所有者へ移る', () => {
    // 経路はマップ依存なので、移動先を直接注入して手数料ロジックを検証する。
    s().reset();
    useGameStore.setState({
      phase: 'moving',
      branches: { tokyo: { ownerId: 'p2', level: 2 } },
      pendingMove: { dest: 'tokyo', path: ['osaka', 'tokyo'] },
    });
    const p1Before = s().players[0].cash;
    const p2Before = s().players[1].cash;
    const fee = BRANCH_SPECS[2].fee;

    s().completeMove(); // p1（現在の手番）が tokyo に到着 → 手数料

    expect(s().players[0].cash).toBe(p1Before - fee);
    expect(s().players[1].cash).toBe(p2Before + fee);
  });

  it('endTurn で自分の支店収益を回収する', () => {
    s().reset();
    useGameStore.setState({
      phase: 'action',
      branches: { osaka: { ownerId: 'p1', level: 3 } },
    });
    const before = s().players[0].cash;
    s().endTurn();
    expect(s().players[0].cash).toBe(
      before + Math.round(BRANCH_SPECS[3].revenue * OSAKA_MULT),
    );
  });

  it('総資産 = 現金 − 借入 + 支店評価額', () => {
    s().reset();
    useGameStore.setState({
      branches: { osaka: { ownerId: 'p1', level: 1 } },
    });
    // 総資産 = 初期現金 + 支店評価額（Lv1）
    expect(s().totalAssets('p1')).toBe(START_CASH + BRANCH_SPECS[1].cost);
  });
});

describe('gameStore — 勝敗', () => {
  beforeEach(() => s().reset());
  afterEach(() => vi.restoreAllMocks());

  it('総資産1億円到達で即ゲーム終了・勝者確定', () => {
    s().reset();
    useGameStore.setState({
      phase: 'action',
      players: s().players.map((p) =>
        p.id === 'p1' ? { ...p, cash: 100_000_000 } : p,
      ),
    });
    s().endTurn();
    expect(s().phase).toBe('gameover');
    expect(s().winnerId).toBe('p1');
  });

  it('100ターン経過で総資産最大が勝者', () => {
    s().reset();
    // 最終プレイヤーの endTurn で turn が 101 になる状況を作る
    useGameStore.setState({
      phase: 'action',
      turn: MAX_TURN,
      currentPlayerIndex: 3,
      players: s().players.map((p) =>
        p.id === 'p3' ? { ...p, cash: 99_000_000 } : p,
      ),
    });
    s().endTurn();
    expect(s().phase).toBe('gameover');
    expect(s().winnerId).toBe('p3');
  });
});

describe('gameStore — 景気・地域育成', () => {
  beforeEach(() => s().reset());
  afterEach(() => vi.restoreAllMocks());

  it('景気倍率：不況0.8 / 普通1.0 / 好況1.2', () => {
    expect(economyMultiplier(1)).toBe(0.8);
    expect(economyMultiplier(2)).toBe(0.8);
    expect(economyMultiplier(3)).toBe(1.0);
    expect(economyMultiplier(4)).toBe(1.2);
    expect(economyMultiplier(5)).toBe(1.2);
  });

  it('好況だと収益が +20%', () => {
    useGameStore.setState({
      phase: 'action',
      economy: 4,
      branches: { osaka: { ownerId: 'p1', level: 3 } },
    });
    const before = s().players[0].cash;
    s().endTurn();
    expect(s().players[0].cash).toBe(
      before + Math.round(BRANCH_SPECS[3].revenue * OSAKA_MULT * 1.2),
    );
  });

  it('地域育成の段数だけ収益がブーストされる', () => {
    useGameStore.setState({
      phase: 'action',
      economy: 3,
      branches: { osaka: { ownerId: 'p1', level: 2 } },
      develop: { osaka: 2 }, // +30%
    });
    const before = s().players[0].cash;
    s().endTurn();
    expect(s().players[0].cash).toBe(
      before + Math.round(BRANCH_SPECS[2].revenue * OSAKA_MULT * 1.3),
    );
  });

  it('developCity：自支店のある都市で費用を払い段数+1', () => {
    useGameStore.setState({
      phase: 'action',
      branches: { tokyo: { ownerId: 'p1', level: 1 } },
      players: s().players.map((p) =>
        p.id === 'p1' ? { ...p, position: 'tokyo' } : p,
      ),
    });
    const before = s().players[0].cash;
    s().developCity();
    expect(s().develop.tokyo).toBe(1);
    expect(s().players[0].cash).toBe(before - 1_000_000);
  });

  it('developCity：他人/未所有の都市では不可', () => {
    useGameStore.setState({
      phase: 'action',
      branches: { tokyo: { ownerId: 'p2', level: 1 } },
      players: s().players.map((p) =>
        p.id === 'p1' ? { ...p, position: 'tokyo' } : p,
      ),
    });
    s().developCity();
    expect(s().develop.tokyo).toBeUndefined();
  });
});

describe('gameStore — イベントカード', () => {
  beforeEach(() => s().reset());
  afterEach(() => vi.restoreAllMocks());

  const cardOf = (id: string) => EVENT_DECK.find((c) => c.id === id)!;

  it('到着時に確率でカードを引き event フェーズへ（手数料マスは除く）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // 出目1 / イベント発生 / 先頭カード
    s().rollDice();
    s().chooseDestination(s().options[0].dest);
    s().completeMove();
    expect(s().phase).toBe('event');
    expect(s().activeCard).not.toBeNull();
  });

  it('手数料マスではイベントを引かず action へ', () => {
    s().reset();
    // 他人の支店へ移動先を直接注入。乱数 0 でもイベントは引かれないこと。
    useGameStore.setState({
      phase: 'moving',
      branches: { tokyo: { ownerId: 'p2', level: 2 } },
      pendingMove: { dest: 'tokyo', path: ['osaka', 'tokyo'] },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    s().completeMove();
    expect(s().phase).toBe('action');
    expect(s().activeCard).toBeNull();
  });

  it('applyEventCard：cash カードで現金が増える', () => {
    useGameStore.setState({
      phase: 'event',
      activeCard: cardOf('local-grant'),
    });
    const before = s().players[0].cash;
    s().applyEventCard();
    expect(s().players[0].cash).toBe(before + 5_000_000);
    expect(s().phase).toBe('action');
    expect(s().activeCard).toBeNull();
  });

  it('applyEventCard：economy カードで景気が変動する', () => {
    useGameStore.setState({
      phase: 'event',
      economy: 3,
      activeCard: cardOf('boj-cut'),
    });
    s().applyEventCard();
    expect(s().economy).toBe(4); // +1
  });

  it('applyEventCard：cityDevelop カードで該当タイプ都市の育成段数が上がる', () => {
    const tourismCity = CITIES.find((c) => c.type === 'tourism')!;
    useGameStore.setState({ phase: 'event', activeCard: cardOf('inbound') });
    s().applyEventCard();
    // inbound = 観光都市の develop +1
    expect(s().develop[tourismCity.id]).toBe(1);
  });
});

describe('gameStore — インターバンク / 連鎖倒産', () => {
  beforeEach(() => s().reset());
  afterEach(() => vi.restoreAllMocks());

  it('現金が足りず利用料を払うと銀行間市場から自動借入する', () => {
    // p1 は現金わずか + 高額支店を保有（純資産は黒字＝破綻しない）。
    // Lv4 支店（利用料 150万）に止まり、不足分を他行から借りる。
    useGameStore.setState({
      phase: 'moving',
      players: s().players.map((p) =>
        p.id === 'p1' ? { ...p, cash: 100_000 } : p,
      ),
      branches: {
        tokyo: { ownerId: 'p2', level: 4 },
        osaka: { ownerId: 'p1', level: 4 }, // p1 のクッション資産
      },
      pendingMove: { dest: 'tokyo', path: ['osaka', 'tokyo'] },
    });

    s().completeMove();

    const p1 = s().players[0];
    expect(p1.bankrupt).toBe(false); // 支店評価額があるので破綻しない
    expect(p1.cash).toBe(0); // 不足分は借入で 0 に
    expect(s().debtOf('p1')).toBeGreaterThan(0); // 借入が発生
    // 借入総額 = 利用料 150万 − 手持ち 10万 = 140万
    expect(s().debtOf('p1')).toBe(BRANCH_SPECS[4].fee - 100_000);
  });

  it('債務超過の行が破綻すると、貸していた行へ損失が連鎖する', () => {
    // p1 → p2 → p3 の与信チェーン。p1 が債務超過なら p2 も債権を失い連鎖破綻。
    useGameStore.setState({
      phase: 'action',
      currentPlayerIndex: 3, // 手番は無関係な p4
      branches: {},
      players: s().players.map((p) => ({ ...p, cash: 0 })),
      loans: [
        { id: 'a', creditorId: 'p2', debtorId: 'p1', principal: 10_000_000 },
        { id: 'b', creditorId: 'p3', debtorId: 'p2', principal: 9_000_000 },
      ],
    });

    s().endTurn();

    const byId = (id: string) => s().players.find((p) => p.id === id)!;
    expect(byId('p1').bankrupt).toBe(true); // 起点の債務超過
    expect(byId('p2').bankrupt).toBe(true); // 債権喪失で連鎖破綻
    expect(byId('p3').bankrupt).toBe(false); // 損失は出すが生存
    expect(byId('p4').bankrupt).toBe(false);
    expect(s().loans).toHaveLength(0); // 破綻に絡むローンは消滅
  });

  it('自分以外が全員破綻すると最後の1行が勝利する', () => {
    useGameStore.setState({
      phase: 'action',
      currentPlayerIndex: 0,
      branches: {},
      // p2,p3,p4 を債務超過にして p1 に貸し付けさせる
      players: s().players.map((p) => ({ ...p, cash: 0 })),
      loans: [
        { id: 'a', creditorId: 'p1', debtorId: 'p2', principal: 5_000_000 },
        { id: 'b', creditorId: 'p1', debtorId: 'p3', principal: 5_000_000 },
        { id: 'c', creditorId: 'p1', debtorId: 'p4', principal: 5_000_000 },
      ],
    });

    s().endTurn();

    expect(s().phase).toBe('gameover');
    expect(s().winnerId).toBe('p1');
  });

  it('自己資本比率と格付け：無借金は AAA、過剰債務は低格付け', () => {
    useGameStore.setState({
      branches: { osaka: { ownerId: 'p1', level: 1 } },
      loans: [],
    });
    expect(s().capital('p1').rating).toBe('AAA');
    expect(s().capital('p1').ratio).toBeCloseTo(1, 5);

    // p1 に多額の借入を負わせると比率が下がる
    useGameStore.setState({
      loans: [
        { id: 'x', creditorId: 'p2', debtorId: 'p1', principal: 4_500_000 },
      ],
    });
    expect(s().capital('p1').ratio).toBeLessThan(CAPITAL_FLOOR + 0.2);
  });
});

describe('gameStore — セーブ / ロード', () => {
  beforeEach(() => s().reset());
  afterEach(() => {
    s().clearSavedGame();
    vi.restoreAllMocks();
  });

  it('saveGame → loadGame で局面を復元し roll から再開する', () => {
    useGameStore.setState({
      turn: 7,
      economy: 5,
      currentPlayerIndex: 2,
      branches: { osaka: { ownerId: 'p1', level: 3 } },
      develop: { osaka: 2 },
    });
    s().saveGame();

    s().reset(); // 一旦まっさら
    expect(s().turn).toBe(1);
    expect(s().branches.osaka).toBeUndefined();

    expect(s().loadGame()).toBe(true);
    expect(s().turn).toBe(7);
    expect(s().economy).toBe(5);
    expect(s().currentPlayerIndex).toBe(2);
    expect(s().branches.osaka).toEqual({ ownerId: 'p1', level: 3 });
    expect(s().develop.osaka).toBe(2);
    expect(s().phase).toBe('roll');
  });

  it('hasSavedGame / clearSavedGame', () => {
    s().saveGame();
    expect(s().hasSavedGame()).toBe(true);
    s().clearSavedGame();
    expect(s().hasSavedGame()).toBe(false);
    expect(s().loadGame()).toBe(false);
  });
});
