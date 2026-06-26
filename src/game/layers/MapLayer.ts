import Phaser from 'phaser';
import type { City } from '../types';
import { CITIES, ROUTES, CITY_BY_ID } from '../mapData';
import { HEX, CITY_TYPE_COLOR, CITY_TYPE_LABEL, FONTS } from '../theme';

/**
 * 実装設計書 4 / シグネチャ要素「路線ネオングロウ」。
 *
 * MapLayer は日本列島マップの静的レイヤーを描画する：
 *   - 路線エッジ（Graphics で描き postFX.addGlow でネオン管のように発光）
 *   - 都市ノード（産業タイプ別の色・グロウ付き）
 *   - 都市名ラベル（Noto Serif JP）
 *
 * GameScene から生成され、コマや支店マーカーはこの上の別レイヤーが担う。
 */
export class MapLayer {
  private scene: Phaser.Scene;
  /** レイヤー全体をまとめるコンテナ（深度管理用）。 */
  readonly container: Phaser.GameObjects.Container;

  /** 路線の発光ライン。 */
  private routeGfx!: Phaser.GameObjects.Graphics;
  /** 都市ノードの円。 */
  private readonly nodeGfxById = new Map<string, Phaser.GameObjects.Graphics>();

  /** ノード半径（産業タイプ共通）。 */
  private static readonly NODE_RADIUS = 16;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);

    this.drawRoutes();
    this.drawNodes();
  }

  /** 路線を 1 枚の Graphics にまとめて描き、ネオングロウを付与する。 */
  private drawRoutes(): void {
    const gfx = this.scene.add.graphics();

    // 下地：細く暗いラインで路線の骨格を描く
    gfx.lineStyle(6, HEX.telegraphBlue, 0.25);
    this.strokeAllRoutes(gfx);

    // 上層：明るいコア。glow と合わさってネオン管らしさを出す
    gfx.lineStyle(2.5, HEX.telegraphBlue, 0.95);
    this.strokeAllRoutes(gfx);

    // シグネチャ要素：ブルームエフェクト（WebGL のみ）
    this.applyGlow(gfx, HEX.telegraphBlue, 4);

    this.routeGfx = gfx;
    this.container.add(gfx);
  }

  /** 全ルートを現在の lineStyle でなぞる。 */
  private strokeAllRoutes(gfx: Phaser.GameObjects.Graphics): void {
    for (const route of ROUTES) {
      const a = CITY_BY_ID[route.from];
      const b = CITY_BY_ID[route.to];
      if (!a || !b) continue;
      gfx.beginPath();
      gfx.moveTo(a.x, a.y);
      gfx.lineTo(b.x, b.y);
      gfx.strokePath();
    }
  }

  /** 都市ノードとラベルを描く。 */
  private drawNodes(): void {
    for (const city of CITIES) {
      this.drawNode(city);
      this.drawLabel(city);
    }
  }

  private drawNode(city: City): void {
    const color = CITY_TYPE_COLOR[city.type] ?? HEX.offWhite;
    const r = MapLayer.NODE_RADIUS;
    const gfx = this.scene.add.graphics({ x: city.x, y: city.y });

    // 外周リング（産業タイプ色）
    gfx.lineStyle(3, color, 1);
    gfx.strokeCircle(0, 0, r);

    // 内側の塗り（暗めの地色でノードを締める）
    gfx.fillStyle(HEX.midnightNavy, 0.85);
    gfx.fillCircle(0, 0, r - 2);

    // 中心のコアドット
    gfx.fillStyle(color, 1);
    gfx.fillCircle(0, 0, r * 0.35);

    this.applyGlow(gfx, color, 2.5);

    // クリック判定（将来の都市ポップアップ用の足場）
    gfx.setInteractive(
      new Phaser.Geom.Circle(0, 0, r + 4),
      Phaser.Geom.Circle.Contains,
    );
    gfx.on('pointerover', () => this.setNodeGlow(gfx, color, 5));
    gfx.on('pointerout', () => this.setNodeGlow(gfx, color, 2.5));
    gfx.on('pointerdown', () => this.scene.events.emit('city:click', city.id));

    this.nodeGfxById.set(city.id, gfx);
    this.container.add(gfx);
  }

  private drawLabel(city: City): void {
    const r = MapLayer.NODE_RADIUS;

    const name = this.scene.add.text(city.x, city.y + r + 6, city.name, {
      fontFamily: FONTS.display,
      fontSize: '18px',
      color: '#e8eaf0',
      fontStyle: 'bold',
    });
    name.setOrigin(0.5, 0);
    name.setShadow(0, 0, '#0a0e1a', 6, true, true);

    const type = this.scene.add.text(
      city.x,
      city.y + r + 28,
      CITY_TYPE_LABEL[city.type] ?? '',
      {
        fontFamily: FONTS.sans,
        fontSize: '11px',
        color: '#7b8499',
      },
    );
    type.setOrigin(0.5, 0);

    this.container.add(name);
    this.container.add(type);
  }

  /**
   * postFX.addGlow を安全に適用する。
   * WebGL レンダラでのみ有効（Canvas フォールバック時は何もしない）。
   */
  private applyGlow(
    obj: Phaser.GameObjects.Graphics,
    color: number,
    outerStrength: number,
  ): void {
    if (this.scene.game.renderer.type !== Phaser.WEBGL) return;
    // postFX が存在するか防御的にチェック
    const fx = (obj as Phaser.GameObjects.Components.FX & typeof obj).postFX;
    if (!fx?.addGlow) return;
    fx.addGlow(color, outerStrength, 0, false, 0.1, 16);
  }

  /** ホバー時などにグロウ強度を差し替える。 */
  private setNodeGlow(
    obj: Phaser.GameObjects.Graphics,
    color: number,
    outerStrength: number,
  ): void {
    if (this.scene.game.renderer.type !== Phaser.WEBGL) return;
    const fx = (obj as Phaser.GameObjects.Components.FX & typeof obj).postFX;
    if (!fx) return;
    fx.clear();
    fx.addGlow(color, outerStrength, 0, false, 0.1, 16);
  }

  destroy(): void {
    this.routeGfx?.destroy();
    this.nodeGfxById.forEach((g) => g.destroy());
    this.nodeGfxById.clear();
    this.container.destroy();
  }
}
