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

/**
 * ターンのフェーズ。
 *   roll     : サイコロ待ち
 *   select   : 出目が確定し、移動先の選択待ち（分岐ハイライト中）
 *   moving   : コマがアニメーション移動中
 *   action   : 到着後の行動（支店設立など）— 現状は確認のみ
 */
export type GamePhase = 'roll' | 'select' | 'moving' | 'action';

export type Player = {
  id: string;
  name: string;
  /** 表示色（プレイヤー1〜4: 青・赤・緑・橙）。CSS 文字列。 */
  color: string;
  /** 現在地（cityId）。 */
  position: string;
  cash: number;
  debt: number;
};
