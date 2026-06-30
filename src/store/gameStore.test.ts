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

  it('総資産 = 現金 + 拠点評価額 + 売掛金 − 買掛金', () => {
    s().reset();
    useGameStore.setState({
      branches: { osaka: { ownerId: 'p1', level: 1 } },
    });
    // 総資産 = 初期現金 + 拠点評価額（Lv1）
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

describe('gameStore — 取引信用 / 連鎖倒産', () => {
  beforeEach(() => s().reset());
  afterEach(() => vi.restoreAllMocks());

  it('現金が足りず取引代金を払えないと不足分が買掛金になる', () => {
    // p1 は現金わずか + 高額拠点を保有（純資産は黒字＝倒産しない）。
    // 他社の Lv4 拠点（取引額 150万）で取引し、足りない分は掛け（買掛金）に。
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
    expect(p1.bankrupt).toBe(false); // 拠点評価額があるので倒産しない
    expect(p1.cash).toBe(0); // 現金で払える分は払い 0 に
    expect(s().payableOf('p1')).toBeGreaterThan(0); // 買掛金が発生
    // 買掛金 = 取引額 150万 − 手持ち 10万 = 140万
    expect(s().payableOf('p1')).toBe(BRANCH_SPECS[4].fee - 100_000);
    // 売り手 p2 は同額の売掛金を持つ
    expect(s().totalAssets('p2')).toBeGreaterThan(0);
  });

  it('債務超過の会社が倒産すると、売掛金を持つ取引先へ損失が連鎖する', () => {
    // p1→p2→p3 の取引信用チェーン（矢印は売り手→買い手）。
    // buyer の p1 が債務超過なら supplier の p2 も売掛金を失い連鎖倒産。
    useGameStore.setState({
      phase: 'action',
      currentPlayerIndex: 3, // 手番は無関係な p4
      branches: {},
      players: s().players.map((p) => ({ ...p, cash: 0 })),
      credits: [
        { id: 'a', supplierId: 'p2', buyerId: 'p1', amount: 10_000_000 },
        { id: 'b', supplierId: 'p3', buyerId: 'p2', amount: 9_000_000 },
      ],
    });

    s().endTurn();

    const byId = (id: string) => s().players.find((p) => p.id === id)!;
    expect(byId('p1').bankrupt).toBe(true); // 起点の債務超過
    expect(byId('p2').bankrupt).toBe(true); // 売掛金焦げ付きで連鎖倒産
    expect(byId('p3').bankrupt).toBe(false); // 損失は出すが生存
    expect(byId('p4').bankrupt).toBe(false);
    expect(s().credits).toHaveLength(0); // 倒産に絡む取引信用は消滅
  });

  it('自分以外が全社倒産すると最後の1社が勝利する', () => {
    useGameStore.setState({
      phase: 'action',
      currentPlayerIndex: 0,
      branches: {},
      // p2,p3,p4 が p1 への買掛金だけを抱えて債務超過（＝p1 の売掛金は焦げ付く）
      players: s().players.map((p) => ({ ...p, cash: 0 })),
      credits: [
        { id: 'a', supplierId: 'p1', buyerId: 'p2', amount: 5_000_000 },
        { id: 'b', supplierId: 'p1', buyerId: 'p3', amount: 5_000_000 },
        { id: 'c', supplierId: 'p1', buyerId: 'p4', amount: 5_000_000 },
      ],
    });

    s().endTurn();

    expect(s().phase).toBe('gameover');
    expect(s().winnerId).toBe('p1');
  });

  it('自己資本比率と格付け：無借金は AAA、過大な買掛金で低格付け', () => {
    useGameStore.setState({
      branches: { osaka: { ownerId: 'p1', level: 1 } },
      credits: [],
    });
    expect(s().capital('p1').rating).toBe('AAA');
    expect(s().capital('p1').ratio).toBeCloseTo(1, 5);

    // p1 に多額の買掛金を負わせると比率が下がる
    useGameStore.setState({
      credits: [
        { id: 'x', supplierId: 'p2', buyerId: 'p1', amount: 4_500_000 },
      ],
    });
    expect(s().capital('p1').ratio).toBeLessThan(CAPITAL_FLOOR + 0.2);
  });
});

describe('gameStore — 経営投資（補助金 / SaaS / DX）', () => {
  beforeEach(() => s().reset());
  afterEach(() => vi.restoreAllMocks());

  it('investDX：DX レベルが上がり、補助金で投資額の一部が戻る', () => {
    useGameStore.setState({
      phase: 'action',
      players: s().players.map((p) =>
        p.id === 'p1' ? { ...p, cash: 10_000_000 } : p,
      ),
    });
    const before = s().players[0].cash;
    const dxCost = s().actionAt('p1').dxCost;
    s().investDX();
    expect(s().players[0].dx).toBe(1);
    const after = s().players[0].cash;
    expect(after).toBeLessThan(before); // 投資して現金は減る
    expect(after).toBeGreaterThan(before - dxCost); // 補助金が一部戻る
  });

  it('DX 化で全拠点の売上が上乗せされる', () => {
    useGameStore.setState({
      phase: 'action',
      economy: 3,
      branches: { osaka: { ownerId: 'p1', level: 3 } },
      players: s().players.map((p) => (p.id === 'p1' ? { ...p, dx: 2 } : p)),
    });
    const before = s().players[0].cash;
    s().endTurn();
    const baseRevenue = Math.round(BRANCH_SPECS[3].revenue * OSAKA_MULT);
    const gained = s().players[0].cash - before;
    expect(gained).toBeGreaterThan(baseRevenue); // DX 分だけ上乗せ
  });

  it('SaaS：加入中は毎ターン月額が引かれる', () => {
    useGameStore.setState({
      phase: 'action',
      branches: {},
      players: s().players.map((p) =>
        p.id === 'p1' ? { ...p, saas: true } : p,
      ),
    });
    const before = s().players[0].cash;
    s().endTurn();
    // 月額 SAAS_FEE（20万）が引かれる
    expect(s().players[0].cash).toBe(before - 200_000);
  });

  it('SaaS：売り手が加入中だと取引額が上乗せ（マッチング）される', () => {
    useGameStore.setState({
      phase: 'moving',
      players: s().players.map((p) =>
        p.id === 'p2' ? { ...p, saas: true } : p,
      ),
      branches: { tokyo: { ownerId: 'p2', level: 2 } },
      pendingMove: { dest: 'tokyo', path: ['osaka', 'tokyo'] },
    });
    const p1Before = s().players[0].cash;
    const p2Before = s().players[1].cash;
    // マッチング上乗せ 1.2 倍
    const fee = Math.round(BRANCH_SPECS[2].fee * 1.2);
    s().completeMove();
    expect(s().players[0].cash).toBe(p1Before - fee);
    expect(s().players[1].cash).toBe(p2Before + fee);
  });

  it('補助金：過疎地域への出店は投資額の一部が戻る', () => {
    const rural = CITIES.find((c) => c.type === 'rural');
    expect(rural).toBeTruthy();
    useGameStore.setState({
      phase: 'action',
      branches: {},
      players: s().players.map((p) =>
        p.id === 'p1' ? { ...p, position: rural!.id, cash: 10_000_000 } : p,
      ),
    });
    const before = s().players[0].cash;
    const cost = s().actionAt('p1').buildCost;
    s().buildBranch();
    expect(s().branches[rural!.id]).toBeTruthy();
    // 出店費を払うが、地方創生補助金で一部戻るので純減は cost 未満
    expect(s().players[0].cash).toBeGreaterThan(before - cost);
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
