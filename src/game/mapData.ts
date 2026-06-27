import type { City, CityType, Route } from './types';
import { CITY_XY } from './japanGeo';

/**
 * 実装設計書 6. マップデータ構造。
 * 都市ノード（産業タイプ・人口・産業活力）と路線エッジを定義する。
 *
 * 座標は japanGeo.ts の CITY_XY（各都市の実緯度経度を 960x720 キャンバスへ
 * 投影したもの）を用いる。これにより日本列島シルエットとノードが整列する。
 */

type CityMeta = {
  id: string;
  name: string;
  type: CityType;
  population: number;
  industryIndex: number;
};

const CITY_META: CityMeta[] = [
  {
    id: 'sapporo',
    name: '札幌',
    type: 'tourism',
    population: 60,
    industryIndex: 55,
  },
  {
    id: 'sendai',
    name: '仙台',
    type: 'industrial',
    population: 55,
    industryIndex: 60,
  },
  {
    id: 'tokyo',
    name: '東京',
    type: 'financial',
    population: 95,
    industryIndex: 95,
  },
  {
    id: 'yokohama',
    name: '横浜',
    type: 'financial',
    population: 85,
    industryIndex: 80,
  },
  {
    id: 'nagoya',
    name: '名古屋',
    type: 'industrial',
    population: 75,
    industryIndex: 85,
  },
  {
    id: 'osaka',
    name: '大阪',
    type: 'financial',
    population: 85,
    industryIndex: 88,
  },
  {
    id: 'kyoto',
    name: '京都',
    type: 'tourism',
    population: 65,
    industryIndex: 60,
  },
  {
    id: 'hiroshima',
    name: '広島',
    type: 'industrial',
    population: 55,
    industryIndex: 65,
  },
  {
    id: 'fukuoka',
    name: '福岡',
    type: 'financial',
    population: 70,
    industryIndex: 72,
  },
  {
    id: 'naha',
    name: '那覇',
    type: 'tourism',
    population: 45,
    industryIndex: 45,
  },
  {
    id: 'niigata',
    name: '新潟',
    type: 'agriculture',
    population: 48,
    industryIndex: 50,
  },
  {
    id: 'kanazawa',
    name: '金沢',
    type: 'tourism',
    population: 45,
    industryIndex: 48,
  },
  {
    id: 'tottori',
    name: '鳥取',
    type: 'rural',
    population: 25,
    industryIndex: 30,
  },
  {
    id: 'kochi',
    name: '高知',
    type: 'rural',
    population: 28,
    industryIndex: 32,
  },
];

export const CITIES: City[] = CITY_META.map((m) => {
  const xy = CITY_XY[m.id];
  if (!xy) throw new Error(`CITY_XY missing coordinate for "${m.id}"`);
  return { ...m, x: xy[0], y: xy[1] };
});

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
