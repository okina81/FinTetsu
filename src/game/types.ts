/**
 * ゲーム設計書 10-3 / 実装設計書 6 に基づくドメイン型。
 */

export type CityType =
  | 'industrial' // 工業都市
  | 'tourism' // 観光都市
  | 'agriculture' // 農業都市
  | 'financial' // 金融都市
  | 'rural'; // 過疎地域

export type City = {
  id: string;
  name: string;
  type: CityType;
  /** マップ座標（Phaser ワールド座標） */
  x: number;
  y: number;
  population: number; // 10-100
  industryIndex: number; // 10-100
  ownerId?: string | null;
  branchLevel?: 0 | 1 | 2 | 3 | 4 | 5;
};

/** 都市間の路線（無向エッジ）。 */
export type Route = {
  from: string;
  to: string;
};

export type BankType = 'regional' | 'mega' | 'net' | 'credit-union';

export type GamePhase = 'roll' | 'move' | 'action' | 'event' | 'end';
