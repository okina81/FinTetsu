import Phaser from 'phaser';
import type { City } from '../types';
import { CITIES, ROUTES, CITY_BY_ID } from '../mapData';
import { JAPAN_PATHS } from '../japanGeo';
import { HEX, CITY_TYPE_COLOR, CITY_TYPE_LABEL, FONTS } from '../theme';
import { useGameStore } from '@/store/gameStore';
import type { GameStore } from '@/store/gameStore';

/**
 * 実装設計書 4 / シグネチャ要素「路線ネオングロウ」。
 *
 * MapLayer は日本列島マップの静的レイヤーを描画する：
 *   - 日本列島シルエット（海岸線をネオン発光させた最下層）
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

  /** 日本列島の陸地塗り。 */
  private landGfx!: Phaser.GameObjects.Graphics;
  /** 海岸線のネオン発光ライン。 */
  private coastGfx!: Phaser.GameObjects.Graphics;
  /** 路線の発光ライン（既定の電信ブルー）。 */
  private routeGfx!: Phaser.GameObjects.Graphics;
  /** プレイヤーごとの「自支店ネットワーク路線」発光ライン（Step 4 路線染め）。 */
  private readonly ownedRouteGfxById = new Map<
    string,
    Phaser.GameObjects.Graphics
  >();
  /** 都市ノードの円。 */
  private readonly nodeGfxById = new Map<string, Phaser.GameObjects.Graphics>();
  /** ストア購読解除関数。 */
  private unsubscribe?: () => void;

  /** ノード半径（産業タイプ共通）。 */
  private static readonly NODE_RADIUS = 16;
  /** 陸地塗り色（海より一段暗くしてシルエットを締める）。 */
  private static readonly LAND_FILL = 0x101b2e;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);

    this.drawJapan(); // 最下層：日本列島シルエット
    this.drawRoutes();
    this.setupOwnedRoutes(); // Step 4：プレイヤー色の路線レイヤー
    this.drawNodes();

    // 支店の増減に応じて路線染めを更新
    this.refreshOwnedRoutes(useGameStore.getState());
    this.unsubscribe = useGameStore.subscribe((s) =>
      this.refreshOwnedRoutes(s),
    );
  }

  /**
   * 日本列島の海岸線シルエットを描く（最下層）。
   * 陸地を暗く塗り、海岸線を電信ブルーでネオン発光させる。
   */
  private drawJapan(): void {
    // 陸地塗り（グロウなし・マット）
    const land = this.scene.add.graphics();
    land.fillStyle(MapLayer.LAND_FILL, 0.92);
    for (const ring of JAPAN_PATHS) {
      this.tracePath(land, ring);
      land.fillPath();
    }
    this.landGfx = land;
    this.container.add(land);

    // 海岸線（ネオングロウ）
    const coast = this.scene.add.graphics();
    coast.lineStyle(1.5, HEX.telegraphBlue, 0.55);
    for (const ring of JAPAN_PATHS) {
      this.tracePath(coast, ring);
      coast.closePath();
      coast.strokePath();
    }
    this.applyGlow(coast, HEX.telegraphBlue, 2);
    this.coastGfx = coast;
    this.container.add(coast);
  }

  /** リング（[x,y] 配列）を現在の Graphics パスへ写す。 */
  private tracePath(gfx: Phaser.GameObjects.Graphics, ring: number[][]): void {
    if (ring.length === 0) return;
    gfx.beginPath();
    gfx.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) {
      gfx.lineTo(ring[i][0], ring[i][1]);
    }
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

  /**
   * Step 4：プレイヤーごとの路線オーバーレイ Graphics を用意する。
   * 各プレイヤー色のグロウを 1 度だけ付与し、以降は内容を描き替える。
   */
  private setupOwnedRoutes(): void {
    for (const p of useGameStore.getState().players) {
      const gfx = this.scene.add.graphics();
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      this.applyGlow(gfx, color, 5);
      this.ownedRouteGfxById.set(p.id, gfx);
      this.container.add(gfx);
    }
  }

  /**
   * 自支店ネットワークの路線を所有者色で塗る。
   * 路線の両端都市が同一プレイヤーの支店なら、その色で発光させる
   * （ターンが進むにつれ日本列島がプレイヤー色に染まっていく演出）。
   */
  private refreshOwnedRoutes(s: GameStore): void {
    const ownerOf = (cityId: string): string | null =>
      s.branches[cityId]?.ownerId ?? null;

    for (const p of s.players) {
      const gfx = this.ownedRouteGfxById.get(p.id);
      if (!gfx) continue;
      gfx.clear();
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      gfx.lineStyle(4, color, 0.9);
      for (const route of ROUTES) {
        if (ownerOf(route.from) === p.id && ownerOf(route.to) === p.id) {
          const a = CITY_BY_ID[route.from];
          const b = CITY_BY_ID[route.to];
          if (!a || !b) continue;
          gfx.beginPath();
          gfx.moveTo(a.x, a.y);
          gfx.lineTo(b.x, b.y);
          gfx.strokePath();
        }
      }
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
    const layout = this.labelLayout(city.x, city.y, r, city.labelPos);

    const name = this.scene.add.text(layout.x, layout.nameY, city.name, {
      fontFamily: FONTS.display,
      fontSize: '17px',
      color: '#e8eaf0',
      fontStyle: 'bold',
    });
    name.setOrigin(layout.originX, layout.originY);
    name.setShadow(0, 0, '#0a0e1a', 6, true, true);

    const type = this.scene.add.text(
      layout.x,
      layout.typeY,
      CITY_TYPE_LABEL[city.type] ?? '',
      {
        fontFamily: FONTS.sans,
        fontSize: '10px',
        color: '#7b8499',
      },
    );
    type.setOrigin(layout.originX, layout.originY);
    type.setShadow(0, 0, '#0a0e1a', 5, true, true);

    this.container.add(name);
    this.container.add(type);
  }

  /** ラベルの配置（方向）を計算する。name と type を 2 行で重ねる。 */
  private labelLayout(
    x: number,
    y: number,
    r: number,
    pos: City['labelPos'],
  ): {
    x: number;
    nameY: number;
    typeY: number;
    originX: number;
    originY: number;
  } {
    switch (pos) {
      case 'above':
        return {
          x,
          nameY: y - r - 20,
          typeY: y - r - 6,
          originX: 0.5,
          originY: 0,
        };
      case 'right':
        return {
          x: x + r + 6,
          nameY: y - 10,
          typeY: y + 6,
          originX: 0,
          originY: 0,
        };
      case 'left':
        return {
          x: x - r - 6,
          nameY: y - 10,
          typeY: y + 6,
          originX: 1,
          originY: 0,
        };
      case 'below':
      default:
        return {
          x,
          nameY: y + r + 5,
          typeY: y + r + 23,
          originX: 0.5,
          originY: 0,
        };
    }
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
    this.unsubscribe?.();
    this.landGfx?.destroy();
    this.coastGfx?.destroy();
    this.routeGfx?.destroy();
    this.ownedRouteGfxById.forEach((g) => g.destroy());
    this.ownedRouteGfxById.clear();
    this.nodeGfxById.forEach((g) => g.destroy());
    this.nodeGfxById.clear();
    this.container.destroy();
  }
}
