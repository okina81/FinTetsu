/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 実装設計書 2-2. カラーパレット
        'midnight-navy': '#0a0e1a', // ベース：深夜ネイビー（画面背景）
        'map-ground': '#1a2435', // マップ地：深緑グレー（マップ背景）
        'finance-gold': '#f5c842', // アクセント1：金融ゴールド（資産・金額・強調）
        'telegraph-blue': '#00b4d8', // アクセント2：電信ブルー（路線・P1）
        'market-red': '#ff4d6d', // アクセント3：相場レッド（警告・マイナス）
        'off-white': '#e8eaf0', // テキスト主：オフホワイト
        'smoke-gray': '#7b8499', // テキスト副：スモークグレー
        // 支店色（P1〜P4）
        'player-1': '#00b4d8', // 青
        'player-2': '#ff4d6d', // 赤
        'player-3': '#4caf50', // 緑
        'player-4': '#ff9800', // 橙
      },
      fontFamily: {
        // 実装設計書 2-3. タイポグラフィ
        display: ['"Noto Serif JP"', 'serif'], // ディスプレイ：タイトル・都市名
        sans: ['"Noto Sans JP"', 'sans-serif'], // UI本文
        mono: ['"JetBrains Mono"', 'monospace'], // 数字・データ
      },
    },
  },
  plugins: [],
};
