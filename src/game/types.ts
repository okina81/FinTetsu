/**
 * ゲーム設計書 10-3 / 実装設計書 6 に基づくドメイン型。
 */

export type CityType =
  | 'industrial' // 工業都市
  | 'tourism' // 観光都市
  | 'agriculture' // 農業都市
  | 'financial' // 金融都市
  | 'rural'; // 過疎地域

/** ラベルの配置方向（密集都市の重なり回避用）。既定は below。 */
export type LabelPos = 'below' | 'above' | 'left' | 'right';

export type City = {
  id: string;
  name: string;
  type: CityType;
  /** マップ座標（Phaser ワールド座標） */
  x: number;
  y: number;
  population: number; // 10-100
  industryIndex: number; // 10-100
  /** 都市名ラベルの配置（密集回避）。 */
  labelPos?: LabelPos;
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
 *   event    : 到着時にイベントカードを引いた（カード演出中）
 *   action   : 到着後の行動（支店設立・強化・ターン終了）
 *   gameover : ゲーム終了（結果表示）
 */
export type GamePhase =
  | 'roll'
  | 'select'
  | 'moving'
  | 'event'
  | 'action'
  | 'gameover';

export type Player = {
  id: string;
  name: string;
  /** 表示色（プレイヤー1〜4: 青・赤・緑・橙）。CSS 文字列。 */
  color: string;
  /** CPU 操作か。 */
  isCpu: boolean;
  /** 現在地（cityId）。 */
  position: string;
  cash: number;
  debt: number;
};

/** 都市に建つ支店。レベル 1〜5。 */
export type Branch = {
  ownerId: string;
  level: 1 | 2 | 3 | 4 | 5;
};

/** 支店レベルごとの諸元（ゲーム設計書 4-2）。 */
export type BranchSpec = {
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  /** 設立／そのレベルへの強化費用（円）。 */
  cost: number;
  /** 他プレイヤーが止まったときの利用料（円）。 */
  fee: number;
  /** 毎ターンの収益（円）。 */
  revenue: number;
};
