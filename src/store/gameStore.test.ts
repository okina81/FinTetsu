import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore, MAX_TURN } from './gameStore';
import { BRANCH_SPECS } from '@/game/branchSpec';

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
    vi.spyOn(Math, 'random').mockReturnValue(0); // 出目 1
    s().rollDice();
    const dest = s().options[0].dest;
    s().chooseDestination(dest);
    s().completeMove();
    expect(s().players[0].position).toBe(dest);
    expect(s().phase).toBe('action');
  });

  it('endTurn は次プレイヤーへ（4人なので turn は据え置き）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
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
    vi.spyOn(Math, 'random').mockReturnValue(0); // 出目 1
    const cashBefore = s().players[0].cash;
    s().rollDice();
    const dest = s().options[0].dest;
    s().chooseDestination(dest);
    s().completeMove();
    s().buildBranch();
    expect(s().branches[dest]).toEqual({ ownerId: 'p1', level: 1 });
    expect(s().players[0].cash).toBe(cashBefore - BRANCH_SPECS[1].cost);
  });

  it('自分の支店は強化でき、レベルが上がる', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
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
    // p2(osaka) の隣に支店を作り、p1 をそこへ止める…のは経路依存なので、
    // ストアに直接ブランチを差し込んで完結的に検証する。
    s().reset();
    // p1 を sendai に置き、tokyo に p2 の Lv2 支店を用意 → p1 が tokyo に来たら手数料
    useGameStore.setState({
      branches: { tokyo: { ownerId: 'p2', level: 2 } },
      players: s().players.map((p) =>
        p.id === 'p1' ? { ...p, position: 'sendai' } : p,
      ),
    });
    const p1Before = s().players[0].cash;
    const p2Before = s().players[1].cash;
    const fee = BRANCH_SPECS[2].fee;

    // sendai -> tokyo は隣接（1歩）
    vi.spyOn(Math, 'random').mockReturnValue(0); // 出目 1
    s().rollDice();
    s().chooseDestination('tokyo');
    s().completeMove();

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
    expect(s().players[0].cash).toBe(before + BRANCH_SPECS[3].revenue);
  });

  it('総資産 = 現金 − 借入 + 支店評価額', () => {
    s().reset();
    useGameStore.setState({
      branches: { osaka: { ownerId: 'p1', level: 1 } },
    });
    // 評価額 Lv1 = 50万。現金は初期 300万。
    expect(s().totalAssets('p1')).toBe(3_000_000 + BRANCH_SPECS[1].cost);
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
