import type { CityType } from './types';

/**
 * 都市タイプごとの「常時効果」。マスの色を意味のあるものにするための単一の真実源。
 *   revenueMult : 毎ターン収益の倍率（タイプ補正）。
 *   buildMult   : 支店設立費の倍率（過疎地域は安い）。
 *   effect      : プレイヤー向けの一言説明（凡例・ポップアップに表示）。
 *
 * 色は theme.ts の CITY_TYPE_COLOR / CITY_TYPE_CSS と対応する。
 */
export const CITY_TYPE_INFO: Record<
  CityType,
  { revenueMult: number; buildMult: number; effect: string }
> = {
  financial: {
    revenueMult: 1.25,
    buildMult: 1.0,
    effect: '収益が高い金融の街',
  },
  industrial: {
    revenueMult: 1.1,
    buildMult: 1.0,
    effect: 'やや高収益／好況に強い',
  },
  tourism: {
    revenueMult: 1.0,
    buildMult: 1.0,
    effect: 'インバウンドで収益が伸びる',
  },
  agriculture: {
    revenueMult: 0.95,
    buildMult: 1.0,
    effect: '収益は控えめ／天候に左右',
  },
  rural: {
    revenueMult: 0.85,
    buildMult: 0.6,
    effect: '設立費が安い／伸びしろ大',
  },
};
