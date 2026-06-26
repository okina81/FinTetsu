# FinTetsu 実装設計書 v0.1
> ゲーム設計書（v0.1）をベースにした、実装直前の技術・ビジュアル統合設計

---

## 1. 技術スタック（確定版）

```
フロントエンド
├── React 18 + TypeScript
├── Phaser 3（ゲームキャンバス本体）
│    ├── マップ描画（TilemapLayer）
│    ├── コマアニメーション（Sprite + Tween）
│    ├── カードエフェクト（Particle + Timeline）
│    └── BGM / SE（Phaser.Sound）
├── Zustand（ゲーム状態管理）
├── Tailwind CSS（React UI部分 = サイドパネル・HUD）
└── Framer Motion（UI遷移アニメ）

ビルド
└── Vite

将来拡張
└── WebSocket（Supabase Realtime）でマルチプレイ
```

### React と Phaser の役割分担

```
┌──────────────────────────────────────────────┐
│  React レイヤー（DOM）                        │
│  ┌────────┐  ┌────────────┐  ┌────────────┐ │
│  │ HUD    │  │ サイドパネル│  │ モーダル   │ │
│  │資産/턴 │  │支店一覧    │  │カード演出  │ │
│  └────────┘  └────────────┘  └────────────┘ │
├──────────────────────────────────────────────┤
│  Phaser キャンバス（Canvas）                  │
│  ・マップ描画                                 │
│  ・コマ移動アニメーション                     │
│  ・マス上のエフェクト                         │
└──────────────────────────────────────────────┘
```

---

## 2. ビジュアルデザイン設計

### 2-1. コンセプト

**「昭和レトロ金融 × デジタルネオン」**

桃鉄の親しみやすさを参照しつつ、金融・経済テーマらしい
"情報密度の高さ" と "緊張感" を表現する。
証券取引所の板情報画面＋路線図＋ゲームの融合。

### 2-2. カラーパレット

| 役割 | 名前 | HEX | 用途 |
|------|------|-----|------|
| ベース | 深夜ネイビー | `#0a0e1a` | 画面背景 |
| マップ地 | 深緑グレー | `#1a2435` | マップ背景 |
| アクセント1 | 金融ゴールド | `#f5c842` | 資産・金額表示・強調 |
| アクセント2 | 電信ブルー | `#00b4d8` | 路線・プレイヤー1 |
| アクセント3 | 相場レッド | `#ff4d6d` | 警告・マイナス・イベント |
| テキスト主 | オフホワイト | `#e8eaf0` | 主要テキスト |
| テキスト副 | スモークグレー | `#7b8499` | 補助テキスト |
| 支店色（P1〜P4） | 青・赤・緑・橙 | `#00b4d8` `#ff4d6d` `#4caf50` `#ff9800` | 各プレイヤー支店 |

### 2-3. タイポグラフィ

| 役割 | フォント | 用途 |
|------|----------|------|
| ディスプレイ | Noto Serif JP（Bold） | ゲームタイトル・都市名 |
| UI本文 | Noto Sans JP（Regular/Medium） | パネル・説明文 |
| 数字・データ | JetBrains Mono | 資産額・金利・数値全般 |

数値にモノスペースを使うのがポイント。
桁が揃い、証券画面っぽさが出る。

### 2-4. シグネチャ要素（このゲームを一番記憶させる要素）

**「路線ネオングロウ」**

マップ上の路線がネオン管のように光る。
自分の支店がある路線は自分の色でグロウし、
ターンが進むにつれて日本列島が色に染まっていく視覚体験。

実装：Phaser の Graphics で路線を描き、
`postFX.addGlow()` でブルームエフェクトを付与。

---

## 3. 画面設計

### 3-1. メインゲーム画面レイアウト

```
┌─────────────────────────────────────────────────────────┐
│ [トップバー]  FinTetsu    ターン 23/100   景気:███░░ 普通 │
├───────────────────────────────────┬─────────────────────┤
│                                   │ [プレイヤーHUD]      │
│                                   │ ┌─────────────────┐ │
│                                   │ │ 🏦 あなた        │ │
│  [Phaserキャンバス]               │ │ ¥12,450万        │ │
│                                   │ │ 借入 ¥3,000万    │ │
│  日本地図マップ                   │ └─────────────────┘ │
│  ・都市ノード                     │ ┌─────────────────┐ │
│  ・路線エッジ（ネオングロウ）     │ │ 👤 CPU銀行A      │ │
│  ・プレイヤーコマ                 │ │ ¥8,200万         │ │
│  ・支店マーカー                   │ └─────────────────┘ │
│                                   ├─────────────────────┤
│                                   │ [支店一覧]           │
│                                   │ 東京 Lv3  ¥250万/T  │
│                                   │ 大阪 Lv2  ¥80万/T   │
│                                   │ 福岡 Lv1  ¥25万/T   │
│                                   ├─────────────────────┤
│                                   │ [手持ちカード]       │
│                                   │ 🃏 地方創生補助金    │
│                                   │ 🃏 フィンテック提携  │
├───────────────────────────────────┴─────────────────────┤
│ [アクションバー]                                         │
│  [🎲 サイコロを振る]  [💼 支店強化]  [🤝 提携交渉]      │
└─────────────────────────────────────────────────────────┘
```

### 3-2. 都市クリック時のポップアップ

```
┌─────────────────────────────────┐
│ 🏙️ 大阪（金融都市）              │
│─────────────────────────────────│
│ 所有者：あなた（Lv3 主要支店）  │
│ 収益：¥80万 / ターン            │
│ 人口指数：72 / 産業活力：85     │
│─────────────────────────────────│
│ 他プレイヤーが来たら：¥60万徴収 │
│─────────────────────────────────│
│ [Lv4に強化 ¥500万] [売却 ¥400万]│
└─────────────────────────────────┘
```

### 3-3. カードイベント演出（モーダル）

```
┌───────────────────────────────────┐
│                                   │
│    ⚡ ハプニング発生！             │
│                                   │
│  ┌─────────────────────────────┐  │
│  │  💀  取り付け騒ぎ            │  │
│  │                             │  │
│  │  全収益が50%ダウン           │  │
│  │  （2ターン間）               │  │
│  └─────────────────────────────┘  │
│                                   │
│         [確認する]                │
└───────────────────────────────────┘
```

### 3-4. サイコロ演出フロー

```
① [サイコロを振る] ボタンタップ
② Phaser上でサイコロが3Dっぽく回転（Tween）
③ 出目エフェクト（ゴールドの数字がバウンス）
④ 移動可能マスがハイライト（分岐がある場合）
⑤ プレイヤーがルートを選択
⑥ コマがパスに沿ってスムーズ移動（Tween.Chain）
⑦ 到着マスでエフェクト発火
```

---

## 4. Phaser シーン構成

```
PhaserGame
├── BootScene        // アセット読み込み・初期化
├── TitleScene       // タイトル画面
├── GameScene        // メインゲームループ
│    ├── MapLayer    // 地図・路線描画
│    ├── PieceLayer  // コマ管理
│    ├── UILayer     // Phaser内UI（吹き出し等）
│    └── EffectLayer // パーティクル・エフェクト
└── ResultScene      // 結果発表
```

---

## 5. ゲーム状態管理（Zustand）

```typescript
// store/gameStore.ts

type GameStore = {
  // ゲーム全体
  state: GameState;

  // アクション
  rollDice: () => number;
  movePlayer: (playerId: string, cityId: string) => void;
  buildBranch: (playerId: string, cityId: string) => void;
  upgradeBranch: (playerId: string, cityId: string) => void;
  drawEventCard: () => EventCard;
  applyEvent: (card: EventCard) => void;
  endTurn: () => void;

  // 計算系
  calcTotalAssets: (playerId: string) => number;
  checkBankruptcy: (playerId: string) => boolean;
  checkVictory: () => string | null; // 勝者のplayerId or null
};
```

---

## 6. マップデータ構造

```typescript
// data/mapData.ts

export const CITIES: City[] = [
  { id: 'sapporo',  name: '札幌',  type: 'tourism',   x: 820, y: 80,  population: 60, industryIndex: 55 },
  { id: 'sendai',   name: '仙台',  type: 'industrial', x: 780, y: 210, population: 55, industryIndex: 60 },
  { id: 'tokyo',    name: '東京',  type: 'financial',  x: 740, y: 310, population: 95, industryIndex: 95 },
  { id: 'yokohama', name: '横浜',  type: 'financial',  x: 720, y: 340, population: 85, industryIndex: 80 },
  { id: 'nagoya',   name: '名古屋', type: 'industrial', x: 620, y: 360, population: 75, industryIndex: 85 },
  { id: 'osaka',    name: '大阪',  type: 'financial',  x: 560, y: 390, population: 85, industryIndex: 88 },
  { id: 'kyoto',    name: '京都',  type: 'tourism',   x: 550, y: 370, population: 65, industryIndex: 60 },
  { id: 'hiroshima',name: '広島',  type: 'industrial', x: 440, y: 420, population: 55, industryIndex: 65 },
  { id: 'fukuoka',  name: '福岡',  type: 'financial',  x: 280, y: 470, population: 70, industryIndex: 72 },
  { id: 'naha',     name: '那覇',  type: 'tourism',   x: 200, y: 620, population: 45, industryIndex: 45 },
  { id: 'niigata',  name: '新潟',  type: 'agriculture', x: 660, y: 240, population: 48, industryIndex: 50 },
  { id: 'kanazawa', name: '金沢',  type: 'tourism',   x: 590, y: 290, population: 45, industryIndex: 48 },
  { id: 'tottori',  name: '鳥取',  type: 'rural',     x: 500, y: 380, population: 25, industryIndex: 30 },
  { id: 'kochi',    name: '高知',  type: 'rural',     x: 490, y: 450, population: 28, industryIndex: 32 },
];

export const ROUTES: Route[] = [
  { from: 'sapporo',  to: 'sendai' },
  { from: 'sendai',   to: 'tokyo' },
  { from: 'sendai',   to: 'niigata' },
  { from: 'tokyo',    to: 'yokohama' },
  { from: 'tokyo',    to: 'nagoya' },
  { from: 'niigata',  to: 'kanazawa' },
  { from: 'kanazawa', to: 'nagoya' },
  { from: 'nagoya',   to: 'osaka' },
  { from: 'osaka',    to: 'kyoto' },
  { from: 'osaka',    to: 'hiroshima' },
  { from: 'kyoto',    to: 'kanazawa' },
  { from: 'hiroshima',to: 'fukuoka' },
  { from: 'hiroshima',to: 'tottori' },
  { from: 'osaka',    to: 'tottori' },
  { from: 'fukuoka',  to: 'naha' },
  { from: 'fukuoka',  to: 'kochi' },
  { from: 'kochi',    to: 'hiroshima' },
];
```

---

## 7. コーディング開始順序

```
Step 1  Vite + React + TypeScript プロジェクト作成
Step 2  Phaser 3 をReactに埋め込む（usePhaserGame hook）
Step 3  MapLayerで都市ノード＋路線を描画
Step 4  ネオングロウエフェクト実装（postFX.addGlow）
Step 5  Zustand でゲーム状態の骨格を作る
Step 6  サイコロ → コマ移動のループを動かす
Step 7  支店設立・手数料徴収ロジック
Step 8  React サイドパネル（HUD・資産表示）
Step 9  イベントカードシステム
Step 10 CPU AIの簡易実装
Step 11 景気ゲージ・地域育成
Step 12 勝利判定・リザルト画面
```

---

*設計書バージョン：v0.1 / 作成：2026年6月*  
*前提：ゲーム設計書 game-design-fintech-momotetsu.md を参照のこと*
