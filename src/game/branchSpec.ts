import type { BranchSpec } from './types';

/**
 * 拠点（店舗）レベル表。中小企業の社長が全国に出店し、店舗を育てて会社を
 * 大きくしていく成長段階。金額は円。
 * fee は他社の社長が立ち寄ったときに発生する「取引額（仕入れ・利用代金）」。
 *
 * | Lv | 名称       | 出店費   | 取引額 | 収益/T |
 * |----|-----------|---------|-------|-------|
 * | 1  | 個人商店   | 50万    | 5万   | 2万   |
 * | 2  | 店舗       | 200万   | 20万  | 8万   |
 * | 3  | 主力店舗   | 500万   | 60万  | 25万  |
 * | 4  | 地域支社   | 1,200万 | 150万 | 80万  |
 * | 5  | 本社       | 3,000万 | 400万 | 250万 |
 */
export const BRANCH_SPECS: Record<1 | 2 | 3 | 4 | 5, BranchSpec> = {
  1: {
    level: 1,
    name: '個人商店',
    cost: 500_000,
    fee: 50_000,
    revenue: 20_000,
  },
  2: { level: 2, name: '店舗', cost: 2_000_000, fee: 200_000, revenue: 80_000 },
  3: {
    level: 3,
    name: '主力店舗',
    cost: 5_000_000,
    fee: 600_000,
    revenue: 250_000,
  },
  4: {
    level: 4,
    name: '地域支社',
    cost: 12_000_000,
    fee: 1_500_000,
    revenue: 800_000,
  },
  5: {
    level: 5,
    name: '本社',
    cost: 30_000_000,
    fee: 4_000_000,
    revenue: 2_500_000,
  },
};

export const MAX_BRANCH_LEVEL = 5 as const;

/** レベル 1..level までの累計投資額（＝拠点評価額）。 */
export function branchValue(level: 1 | 2 | 3 | 4 | 5): number {
  let sum = 0;
  for (let l = 1 as 1 | 2 | 3 | 4 | 5; l <= level; l++) {
    sum += BRANCH_SPECS[l].cost;
  }
  return sum;
}

/** 現在 level から次レベルへ強化する費用（level=5 は不可で 0）。 */
export function upgradeCost(level: 1 | 2 | 3 | 4 | 5): number {
  if (level >= MAX_BRANCH_LEVEL) return 0;
  return BRANCH_SPECS[(level + 1) as 2 | 3 | 4 | 5].cost;
}
