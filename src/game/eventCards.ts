import type { CityType } from './types';

/**
 * ゲーム設計書 6-1 イベントカード。
 * チャンス（好）/ ハプニング（悪）/ 地域経済（地域連動）の 3 種。
 *
 * 効果は確定的に適用できるよう、タグ付きの EventEffect で表現する：
 *   - cash        : カードを引いたプレイヤーの現金を増減
 *   - economy     : 景気レベルを増減（クランプ）
 *   - cityDevelop : 指定産業タイプの都市の地域育成段数を増減（収益に波及）
 */

export type EventCategory = 'chance' | 'happening' | 'regional';

export type EventEffect =
  | { kind: 'cash'; amount: number }
  | { kind: 'economy'; delta: number }
  | { kind: 'cityDevelop'; cityType: CityType; delta: number };

export type EventCard = {
  id: string;
  category: EventCategory;
  title: string;
  description: string;
  effect: EventEffect;
};

export const EVENT_DECK: EventCard[] = [
  // 🎴 チャンス
  {
    id: 'boj-cut',
    category: 'chance',
    title: '政府の景気対策',
    description: '消費が上向き商機が広がる（景気+1）',
    effect: { kind: 'economy', delta: 1 },
  },
  {
    id: 'local-grant',
    category: 'chance',
    title: 'ものづくり補助金 採択',
    description: '補助金を獲得（+500万）',
    effect: { kind: 'cash', amount: 5_000_000 },
  },
  {
    id: 'fintech',
    category: 'chance',
    title: '大手企業と取引開始',
    description: '新規取引でまとまった売上（+300万）',
    effect: { kind: 'cash', amount: 3_000_000 },
  },
  {
    id: 'mna',
    category: 'chance',
    title: '大口受注を獲得',
    description: '受注益を獲得（+400万）',
    effect: { kind: 'cash', amount: 4_000_000 },
  },
  // 💀 ハプニング
  {
    id: 'fraud',
    category: 'happening',
    title: '製品リコール発生',
    description: '回収・賠償費用を支払う（-300万）',
    effect: { kind: 'cash', amount: -3_000_000 },
  },
  {
    id: 'bankrun',
    category: 'happening',
    title: '消費の冷え込み',
    description: '財布のひもが固くなる（景気-1）',
    effect: { kind: 'economy', delta: -1 },
  },
  {
    id: 'quake',
    category: 'happening',
    title: '地震・災害',
    description: '復旧費用が発生（-200万）',
    effect: { kind: 'cash', amount: -2_000_000 },
  },
  {
    id: 'negative-rate',
    category: 'happening',
    title: '原材料・仕入れ価格の高騰',
    description: 'コスト増で利益が圧迫される（景気-1）',
    effect: { kind: 'economy', delta: -1 },
  },
  // 🏙️ 地域経済
  {
    id: 'inbound',
    category: 'regional',
    title: 'インバウンド回復',
    description: '観光都市が活況に（観光都市の売上UP）',
    effect: { kind: 'cityDevelop', cityType: 'tourism', delta: 1 },
  },
  {
    id: 'factory-move',
    category: 'regional',
    title: '工場移転',
    description: '工業都市が打撃を受ける（工業都市の売上DOWN）',
    effect: { kind: 'cityDevelop', cityType: 'industrial', delta: -1 },
  },
  {
    id: 'bad-harvest',
    category: 'regional',
    title: '農業不作',
    description: '農業都市が不振に（農業都市の売上DOWN）',
    effect: { kind: 'cityDevelop', cityType: 'agriculture', delta: -1 },
  },
  {
    id: 'migration',
    category: 'regional',
    title: '移住促進キャンペーン',
    description: '過疎地域が活気づく（過疎地域の売上UP）',
    effect: { kind: 'cityDevelop', cityType: 'rural', delta: 1 },
  },
];

/** デッキからランダムに 1 枚引く。 */
export function drawEventCard(): EventCard {
  return EVENT_DECK[Math.floor(Math.random() * EVENT_DECK.length)];
}
