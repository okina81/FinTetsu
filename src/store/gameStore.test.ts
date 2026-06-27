import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from './gameStore';

const s = () => useGameStore.getState();

describe('gameStore — サイコロ→移動ループ', () => {
  beforeEach(() => s().reset());
  afterEach(() => vi.restoreAllMocks());

  it('初期状態', () => {
    expect(s().turn).toBe(1);
    expect(s().phase).toBe('roll');
    expect(s().players[0].position).toBe('tokyo');
    expect(s().players[0].cash).toBeGreaterThan(0);
  });

  it('rollDice は出目と移動先候補を出し select フェーズへ', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // -> 出目 4
    s().rollDice();
    expect(s().dice).toBe(4);
    expect(s().phase).toBe('select');
    expect(s().options.length).toBeGreaterThan(0);
  });

  it('roll フェーズ以外では rollDice を無視する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    s().rollDice(); // -> select
    const before = s().dice;
    s().rollDice(); // 無視されるはず
    expect(s().dice).toBe(before);
    expect(s().phase).toBe('select');
  });

  it('chooseDestination は候補外を無視し、候補は moving へ', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    s().rollDice();
    s().chooseDestination('___invalid___');
    expect(s().phase).toBe('select');

    const dest = s().options[0].dest;
    s().chooseDestination(dest);
    expect(s().phase).toBe('moving');
    expect(s().pendingMove?.dest).toBe(dest);
  });

  it('completeMove で現在地が更新され action フェーズへ', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    s().rollDice();
    const dest = s().options[0].dest;
    s().chooseDestination(dest);
    s().completeMove();
    expect(s().players[0].position).toBe(dest);
    expect(s().phase).toBe('action');
    expect(s().pendingMove).toBeNull();
  });

  it('endTurn で turn が進み roll フェーズに戻る（単独プレイ）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    s().rollDice();
    s().chooseDestination(s().options[0].dest);
    s().completeMove();
    s().endTurn();
    expect(s().turn).toBe(2);
    expect(s().phase).toBe('roll');
    expect(s().dice).toBeNull();
  });

  it('1 ターン分のフルループが整合する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.34); // -> 出目 3
    const start = s().players[0].position;
    s().rollDice();
    expect(s().dice).toBe(3);
    const dest = s().options[0].dest;
    expect(dest).not.toBe(start);
    s().chooseDestination(dest);
    s().completeMove();
    expect(s().players[0].position).toBe(dest);
    s().endTurn();
    expect(s().phase).toBe('roll');
  });
});
