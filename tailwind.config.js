/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ポップ・カートゥーン路線のカラーパレット
        // 画面の地色は「ブルーベリー」の親しみやすい濃紺、マップは従来のネオン地。
        'midnight-navy': '#1b1d3a', // ベース：ブルーベリー（画面背景）
        'map-ground': '#141a2e', // マップ地（Phaser 背景・ネオン映え）
        'blueberry-700': '#252a52', // パネル地
        'blueberry-600': '#2f356a', // パネル明
        'finance-gold': '#ffd44d', // 資産・金額・主役アクセント
        'candy-pink': '#ff6fae', // ポップ・ピンク
        'candy-teal': '#36d6c3', // ポップ・ティール
        'candy-grape': '#9b6dff', // ポップ・パープル
        'telegraph-blue': '#3dc6ff', // 路線・P1（やや明るく）
        'market-red': '#ff5d7a', // 警告・マイナス
        'leaf-green': '#5fd97a', // P3・好調
        'off-white': '#f3f1ff', // テキスト主
        'smoke-gray': '#9aa0c8', // テキスト副
        // 支店色（P1〜P4）— 明るめポップ
        'player-1': '#3dc6ff', // 水色
        'player-2': '#ff6fae', // ピンク
        'player-3': '#5fd97a', // 緑
        'player-4': '#ffae3d', // 橙
      },
      fontFamily: {
        display: ['"Mochiy Pop One"', 'sans-serif'], // 見出し・タイトル（丸ポップ）
        sans: ['"M PLUS Rounded 1c"', 'sans-serif'], // UI本文（丸ゴシック）
        mono: ['"JetBrains Mono"', 'monospace'], // 数字・データ
      },
      boxShadow: {
        pop: '0 4px 0 rgba(0,0,0,0.25)', // ステッカー風の厚みのある影
        'pop-lg': '0 6px 0 rgba(0,0,0,0.3)',
      },
      borderRadius: {
        pop: '1.25rem',
      },
      keyframes: {
        // サイコロ確定時のバウンス（実装設計書 3-4 出目演出）
        dicePop: {
          '0%': { transform: 'scale(1.6) rotate(-12deg)', opacity: '0.4' },
          '60%': { transform: 'scale(0.92) rotate(4deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        // サイコロ回転中のシェイク
        diceSpin: {
          '0%,100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        titleGlow: {
          '0%,100%': { textShadow: '0 0 12px rgba(255,212,77,0.5)' },
          '50%': { textShadow: '0 0 24px rgba(255,212,77,0.9)' },
        },
        // ふわっと登場（モーダル・マスコット）
        popIn: {
          '0%': { transform: 'scale(0.8) translateY(8px)', opacity: '0' },
          '70%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        // ゆるく上下に弾むマスコット
        bob: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'dice-pop': 'dicePop 0.4s ease-out',
        'dice-spin': 'diceSpin 0.12s linear infinite',
        'title-glow': 'titleGlow 2.4s ease-in-out infinite',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        bob: 'bob 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
