# 🏦 FinTetsu（フィン鉄）

> 日本全国の都市を巡りながら銀行支店を買収・経営し、地域経済を育てて資産日本一を目指すボードゲーム型ブラウザゲーム。

ゲームルールは `game-design-fintech-momotetsu.md`、技術・ビジュアル設計は
`fintetsu-impl-design.md` を参照。

## 技術スタック

| 層 | 技術 |
|----|------|
| ビルド | Vite |
| UI | React 18 + TypeScript |
| ゲームキャンバス | Phaser 3（WebGL / postFX グロウ） |
| 状態管理 | Zustand（後続ステップ） |
| スタイリング | Tailwind CSS |

React（DOM）が HUD・サイドパネル・モーダルを、Phaser（Canvas）がマップ描画・
コマ移動・エフェクトを担う役割分担。

## セットアップ

```bash
npm install
npm run dev      # 開発サーバ（http://localhost:5173）
npm run build    # 型チェック + 本番ビルド
npm run preview  # ビルド結果のプレビュー
npm run lint     # tsc 型チェックのみ
```

## 実装の進捗（コーディング開始順序）

- [x] **Step 1** Vite + React + TypeScript プロジェクト作成
- [x] **Step 2** Phaser 3 を React に埋め込む（`usePhaserGame` hook）
- [x] **Step 3** MapLayer で都市ノード＋路線を描画（ネオングロウ込み）
- [x] **Step 5** Zustand でゲーム状態の骨格（`store/gameStore.ts`）
- [x] **Step 6** サイコロ → コマ移動ループ（`PieceLayer` + `pathfind`）
- [ ] Step 4 ネオングロウの拡張（自支店路線の色染め）
- [ ] Step 7 支店設立・手数料徴収
- [ ] Step 8 React サイドパネル（HUD・資産表示）
- [ ] Step 9 イベントカードシステム
- [ ] Step 10 CPU AI
- [ ] Step 11 景気ゲージ・地域育成
- [ ] Step 12 勝利判定・リザルト画面

## ディレクトリ構成

```
src/
├── App.tsx                  メイン画面レイアウト（React シェル）
├── main.tsx                 エントリポイント
├── index.css                Tailwind + ベーススタイル
├── components/
│   └── PhaserContainer.tsx  Phaser キャンバスのホスト
├── hooks/
│   └── usePhaserGame.ts     Phaser.Game のマウント/破棄を管理
└── game/
    ├── createGame.ts        Phaser.Game 設定ファクトリ
    ├── theme.ts             カラーパレット・フォント（単一の真実源）
    ├── types.ts             ドメイン型（City / Route ほか）
    ├── mapData.ts           都市ノード・路線データ
    ├── scenes/
    │   ├── BootScene.ts     初期化・アセット読み込み
    │   └── GameScene.ts     メインゲームループ
    └── layers/
        └── MapLayer.ts      地図・路線・ノード描画 + ネオングロウ
```

## デザイントークン

カラーパレット・フォントは実装設計書 2-2 / 2-3 に準拠し、`src/game/theme.ts`
（Phaser 用）と `tailwind.config.js`（React 用）で同期している。

- ベース `#0a0e1a` / マップ地 `#1a2435`
- 金融ゴールド `#f5c842` / 電信ブルー `#00b4d8` / 相場レッド `#ff4d6d`
- フォント：Noto Serif JP（見出し）/ Noto Sans JP（本文）/ JetBrains Mono（数値）
