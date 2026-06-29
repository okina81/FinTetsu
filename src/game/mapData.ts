import type { City, Route } from './types';
import { STATIONS, STATION_ROUTES, BOARD_W, BOARD_H } from './stationsData';
import { STATION_JP_NAMES } from './stationNames';

/**
 * マップデータ。約350の実在都市（駅）と、近接グラフで生成した路線。
 * 座標・路線・海岸線は scripts/build-stations が生成した stationsData に集約。
 * 主要駅は日本語表記に上書きする（stationNames）。
 */

export const CITIES: City[] = STATIONS.map((c) =>
  STATION_JP_NAMES[c.id] ? { ...c, name: STATION_JP_NAMES[c.id] } : c,
);
export const ROUTES: Route[] = STATION_ROUTES;

/** ボード（ワールド）サイズ。カメラ境界に使う。 */
export { BOARD_W, BOARD_H };

/** id から都市を引く索引。 */
export const CITY_BY_ID: Record<string, City> = Object.fromEntries(
  CITIES.map((c) => [c.id, c]),
);
