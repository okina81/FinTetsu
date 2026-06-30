# 🏪 FinTetsu（フィン鉄）

> 中小企業の社長として日本全国に出店し、取引を広げて会社を育て、資産日本一を目指すボードゲーム型ブラウザゲーム。取引先の倒産で売掛金が焦げ付く「連鎖倒産」が勝負の肝。

ゲームルールは `game-design-fintech-momotetsu.md`、技術・ビジュアル設計は
`fintetsu-impl-design.md` を参照。

## 技術スタック

| 層               | 技術                              |
| ---------------- | --------------------------------- |
| ビルド           | Vite                              |
| UI               | React 18 + TypeScript             |
| ゲームキャンバス | Phaser 3（WebGL / postFX グロウ） |
| 状態管理         | Zustand（後続ステップ）           |
| スタイリング     | Tailwind CSS                      |

React（DOM）が HUD・サイドパネル・モーダルを、Phaser（Canvas）がマップ描画・
コマ移動・エフェクトを担う役割分担。

## セットアップ

```bash
npm install
npm run dev          # 開発サーバ（http://localhost:5173）
npm run build        # 型チェック + 本番ビルド
npm run preview      # ビルド結果のプレビュー

# 品質チェック（CI と同じ）
npm run typecheck    # tsc 型チェック
npm run lint         # ESLint
npm run format       # Prettier で整形（format:check で確認のみ）
npm test             # Vitest（pathfind / gameStore のユニットテスト）
```

## 品質ゲート（CI）

`.github/workflows/ci.yml` が push / PR 時に **型チェック → lint → format:check →
テスト → ビルド** を実行する。ローカルでは上記スクリプトで同じ検証ができる。

## 実装の進捗（コーディング開始順序）

- [x] **Step 1** Vite + React + TypeScript プロジェクト作成
- [x] **Step 2** Phaser 3 を React に埋め込む（`usePhaserGame` hook）
- [x] **Step 3** MapLayer で都市ノード＋路線を描画（ネオングロウ込み）
- [x] **Step 5** Zustand でゲーム状態の骨格（`store/gameStore.ts`）
- [x] **Step 6** サイコロ → コマ移動ループ（`PieceLayer` + `pathfind`）
- [x] **Step 7** 支店設立・強化・手数料徴収・収益（`branchSpec` + 経済ロジック）
- [x] **Step 8** React サイドパネル（全プレイヤー資産・拠点一覧）
- [x] **Step 10** CPU AI（簡易・`useCpuController`）
- [x] **Step 12** 勝利判定・リザルト画面（1億円達成 / 100ターン）
- [x] **Step 13** 連鎖倒産の中核（取引信用・自己資本比率・連鎖倒産）★最小スライス
- [x] **Step 14** 経営投資レイヤー（補助金・経営支援SaaS・DX化）
- [ ] Step 4 ネオングロウの拡張（自社路線の色染め）
- [ ] Step 9 イベントカードシステム
- [ ] Step 11 景気ゲージ・地域育成

> **設計の方向転換：** 中核を「物件収集すごろく」から
> **連鎖倒産（取引先倒産→売掛金焦げ付き）** へ作り直し（v0.2）、
> 世界観を **「中小企業の社長」** に再構成（v0.3）、
> **経営投資レイヤー（補助金・経営支援SaaS・DX化）** を追加（v0.4）。詳細は
> `docs/game-design-fintech-momotetsu.md` 13〜15章。

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
