/**
 * 実装設計書 2-2 / 2-3 に基づく共通テーマ定義。
 * React (Tailwind) と Phaser の双方から参照する単一の真実源。
 *
 * Phaser は数値カラー (0xRRGGBB) を要求するため、文字列とは別に number 版も保持する。
 */

/** CSS 文字列カラー（#RRGGBB） */
export const COLORS = {
  midnightNavy: '#0a0e1a', // ベース：画面背景
  mapGround: '#1a2435', // マップ地：マップ背景
  financeGold: '#f5c842', // アクセント1：資産・金額・強調
  telegraphBlue: '#00b4d8', // アクセント2：路線・プレイヤー1
  marketRed: '#ff4d6d', // アクセント3：警告・マイナス・イベント
  offWhite: '#e8eaf0', // テキスト主
  smokeGray: '#7b8499', // テキスト副
} as const;

/** プレイヤー支店色（P1〜P4） */
export const PLAYER_COLORS = ['#00b4d8', '#ff4d6d', '#4caf50', '#ff9800'] as const;

/** Phaser 用 number カラー（0xRRGGBB） */
export const HEX = {
  midnightNavy: 0x0a0e1a,
  mapGround: 0x1a2435,
  financeGold: 0xf5c842,
  telegraphBlue: 0x00b4d8,
  marketRed: 0xff4d6d,
  offWhite: 0xe8eaf0,
  smokeGray: 0x7b8499,
} as const;

export const PLAYER_HEX = [0x00b4d8, 0xff4d6d, 0x4caf50, 0xff9800] as const;

/** 都市タイプごとのノード配色（産業分類）。 */
export const CITY_TYPE_COLOR: Record<string, number> = {
  industrial: 0x9aa6c0, // 工業都市
  tourism: 0x00b4d8, // 観光都市
  agriculture: 0x4caf50, // 農業都市
  financial: 0xf5c842, // 金融都市（メガバンクの本拠地）
  rural: 0xff9800, // 過疎地域
};

/** 都市タイプの日本語ラベル。 */
export const CITY_TYPE_LABEL: Record<string, string> = {
  industrial: '工業都市',
  tourism: '観光都市',
  agriculture: '農業都市',
  financial: '金融都市',
  rural: '過疎地域',
};

export const FONTS = {
  display: '"Noto Serif JP", serif',
  sans: '"Noto Sans JP", sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;
