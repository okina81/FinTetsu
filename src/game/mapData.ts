import type { City, Route } from './types';

/**
 * 実装設計書 6. マップデータ構造。
 * 都市ノード（座標・産業タイプ・人口・産業活力）と路線エッジを定義する。
 */

export const CITIES: City[] = [
  { id: 'sapporo', name: '札幌', type: 'tourism', x: 820, y: 80, population: 60, industryIndex: 55 },
  { id: 'sendai', name: '仙台', type: 'industrial', x: 780, y: 210, population: 55, industryIndex: 60 },
  { id: 'tokyo', name: '東京', type: 'financial', x: 740, y: 310, population: 95, industryIndex: 95 },
  { id: 'yokohama', name: '横浜', type: 'financial', x: 720, y: 340, population: 85, industryIndex: 80 },
  { id: 'nagoya', name: '名古屋', type: 'industrial', x: 620, y: 360, population: 75, industryIndex: 85 },
  { id: 'osaka', name: '大阪', type: 'financial', x: 560, y: 390, population: 85, industryIndex: 88 },
  { id: 'kyoto', name: '京都', type: 'tourism', x: 550, y: 370, population: 65, industryIndex: 60 },
  { id: 'hiroshima', name: '広島', type: 'industrial', x: 440, y: 420, population: 55, industryIndex: 65 },
  { id: 'fukuoka', name: '福岡', type: 'financial', x: 280, y: 470, population: 70, industryIndex: 72 },
  { id: 'naha', name: '那覇', type: 'tourism', x: 200, y: 620, population: 45, industryIndex: 45 },
  { id: 'niigata', name: '新潟', type: 'agriculture', x: 660, y: 240, population: 48, industryIndex: 50 },
  { id: 'kanazawa', name: '金沢', type: 'tourism', x: 590, y: 290, population: 45, industryIndex: 48 },
  { id: 'tottori', name: '鳥取', type: 'rural', x: 500, y: 380, population: 25, industryIndex: 30 },
  { id: 'kochi', name: '高知', type: 'rural', x: 490, y: 450, population: 28, industryIndex: 32 },
];

export const ROUTES: Route[] = [
  { from: 'sapporo', to: 'sendai' },
  { from: 'sendai', to: 'tokyo' },
  { from: 'sendai', to: 'niigata' },
  { from: 'tokyo', to: 'yokohama' },
  { from: 'tokyo', to: 'nagoya' },
  { from: 'niigata', to: 'kanazawa' },
  { from: 'kanazawa', to: 'nagoya' },
  { from: 'nagoya', to: 'osaka' },
  { from: 'osaka', to: 'kyoto' },
  { from: 'osaka', to: 'hiroshima' },
  { from: 'kyoto', to: 'kanazawa' },
  { from: 'hiroshima', to: 'fukuoka' },
  { from: 'hiroshima', to: 'tottori' },
  { from: 'osaka', to: 'tottori' },
  { from: 'fukuoka', to: 'naha' },
  { from: 'fukuoka', to: 'kochi' },
  { from: 'kochi', to: 'hiroshima' },
];

/** id から都市を引く索引。 */
export const CITY_BY_ID: Record<string, City> = Object.fromEntries(
  CITIES.map((c) => [c.id, c]),
);
