/**
 * ポップ・カートゥーン路線の共通テーマ定義。
 * React (Tailwind) と Phaser の双方から参照する単一の真実源。
 *
 * Phaser は数値カラー (0xRRGGBB) を要求するため、文字列とは別に number 版も保持する。
 */

/** CSS 文字列カラー（#RRGGBB） */
export const COLORS = {
  midnightNavy: '#1b1d3a', // ベース：ブルーベリー
  mapGround: '#141a2e', // マップ地：マップ背景（ネオン映え）
  financeGold: '#ffd44d', // 資産・金額・強調
  telegraphBlue: '#3dc6ff', // 路線・プレイヤー1
  marketRed: '#ff5d7a', // 警告・マイナス・イベント
  offWhite: '#f3f1ff', // テキスト主
  smokeGray: '#9aa0c8', // テキスト副
} as const;

/** プレイヤー支店色（P1〜P4）— ポップ配色 */
export const PLAYER_COLORS = [
  '#3dc6ff',
  '#ff6fae',
  '#5fd97a',
  '#ffae3d',
] as const;

/** Phaser 用 number カラー（0xRRGGBB） */
export const HEX = {
  midnightNavy: 0x1b1d3a,
  mapGround: 0x141a2e,
  financeGold: 0xffd44d,
  telegraphBlue: 0x3dc6ff,
  candyTeal: 0x36d6c3,
  marketRed: 0xff5d7a,
  offWhite: 0xf3f1ff,
  smokeGray: 0x9aa0c8,
} as const;

export const PLAYER_HEX = [0x3dc6ff, 0xff6fae, 0x5fd97a, 0xffae3d] as const;

/** 都市タイプごとのノード配色（産業分類）。 */
export const CITY_TYPE_COLOR: Record<string, number> = {
  industrial: 0xb6bee0, // 工業都市
  tourism: 0x3dc6ff, // 観光都市
  agriculture: 0x5fd97a, // 農業都市
  financial: 0xffd44d, // 金融都市
  rural: 0xffae3d, // 過疎地域
};

/** 都市タイプごとのノード配色（CSS 文字列版・凡例の色見本用）。 */
export const CITY_TYPE_CSS: Record<string, string> = {
  industrial: '#b6bee0',
  tourism: '#3dc6ff',
  agriculture: '#5fd97a',
  financial: '#ffd44d',
  rural: '#ffae3d',
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
  display: '"Mochiy Pop One", sans-serif',
  sans: '"M PLUS Rounded 1c", sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;
