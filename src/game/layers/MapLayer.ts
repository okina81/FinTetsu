import Phaser from 'phaser';
import { CITIES, ROUTES, CITY_BY_ID } from '../mapData';
import { JAPAN_PATHS } from '../stationsData';
import { HEX, CITY_TYPE_COLOR, FONTS } from '../theme';
import { useGameStore } from '@/store/gameStore';
import type { GameStore } from '@/store/gameStore';

/**
 * 実装設計書 4 / シグネチャ要素「路線ネオングロウ」。約350駅の大型ボード向けに
 * バッチ描画で最適化している（ノードは 1 枚の Graphics にまとめ、postFX は
 * レイヤー単位でのみ適用）。
 *
 *   - 日本列島シルエット（海岸線をネオン発光）
 *   - 路線エッジ（1 枚にまとめてグロウ）
 *   - 自支店ネットワークの色染め（プレイヤー色・Step 4）
 *   - 都市ノード（産業タイプ別の色、1 枚にバッチ）＋主要駅ラベル
 *
 * コマ・支店マーカーは PieceLayer、カメラ操作・ノードのクリック判定は
 * GameScene が担う。
 */
export class MapLayer {
  private scene: Phaser.Scene;
  readonly container: Phaser.GameObjects.Container;

  private landGfx!: Phaser.GameObjects.Graphics;
  private coastGfx!: Phaser.GameObjects.Graphics;
  private routeGfx!: Phaser.GameObjects.Graphics;
  private ferryGfx!: Phaser.GameObjects.Graphics;
  private readonly ferryMarkers: Phaser.GameObjects.Text[] = [];
  private nodesGfx!: Phaser.GameObjects.Graphics;
  /** 主要駅ラベル（常時表示）。 */
  private readonly labels: Phaser.GameObjects.Text[] = [];
  /** その他の駅ラベル（ズームイン時のみ表示・LOD）。 */
  private readonly minorLabels: Phaser.GameObjects.Text[] = [];
  private minorVisible = false;
  /** プレイヤーごとの自支店路線レイヤー。 */
  private readonly ownedRouteGfxById = new Map<
    string,
    Phaser.GameObjects.Graphics
  >();
  private unsubscribe?: () => void;

  /** ノード半径（密な大型ボード向けに小さめ）。 */
  static readonly NODE_RADIUS = 7;
  /** ラベルを常時表示する人口しきい値（主要駅のみ）。 */
  private static readonly LABEL_POP = 60;
  /** minor 駅ラベルを表示し始めるズーム倍率。 */
  private static readonly LOD_ZOOM = 0.95;
  /** これより長い区間はフェリー航路として破線描画する（px）。 */
  private static readonly FERRY_LEN = 300;
  private static readonly LAND_FILL = 0x101b2e;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);

    this.drawJapan();
    this.drawRoutes();
    this.setupOwnedRoutes();
    this.drawNodes();
    this.drawLabels();

    this.refreshOwnedRoutes(useGameStore.getState());
    this.unsubscribe = useGameStore.subscribe((s) =>
      this.refreshOwnedRoutes(s),
    );
  }

  private drawJapan(): void {
    const land = this.scene.add.graphics();
    land.fillStyle(MapLayer.LAND_FILL, 0.92);
    for (const ring of JAPAN_PATHS) {
      this.tracePath(land, ring);
      land.fillPath();
    }
    this.landGfx = land;
    this.container.add(land);

    const coast = this.scene.add.graphics();
    coast.lineStyle(1.5, HEX.telegraphBlue, 0.5);
    for (const ring of JAPAN_PATHS) {
      this.tracePath(coast, ring);
      coast.closePath();
      coast.strokePath();
    }
    this.applyGlow(coast, HEX.telegraphBlue, 2);
    this.coastGfx = coast;
    this.container.add(coast);
  }

  private tracePath(gfx: Phaser.GameObjects.Graphics, ring: number[][]): void {
    if (ring.length === 0) return;
    gfx.beginPath();
    gfx.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) gfx.lineTo(ring[i][0], ring[i][1]);
  }

  /** 全路線を 1 枚にまとめて描き、ネオングロウを付与する。 */
  private drawRoutes(): void {
    // 陸路（実線・ネオン）
    const gfx = this.scene.add.graphics();
    gfx.lineStyle(4, HEX.telegraphBlue, 0.22);
    this.strokeAllRoutes(gfx);
    gfx.lineStyle(1.6, HEX.telegraphBlue, 0.9);
    this.strokeAllRoutes(gfx);
    this.applyGlow(gfx, HEX.telegraphBlue, 3);
    this.routeGfx = gfx;
    this.container.add(gfx);

    this.drawFerryRoutes();
  }

  /** 区間が長い路線は「フェリー航路」とみなす（沖縄連絡線など）。 */
  private isFerry(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y) > MapLayer.FERRY_LEN;
  }

  private strokeAllRoutes(gfx: Phaser.GameObjects.Graphics): void {
    for (const route of ROUTES) {
      const a = CITY_BY_ID[route.from];
      const b = CITY_BY_ID[route.to];
      if (!a || !b || this.isFerry(a, b)) continue; // フェリーは別描画
      gfx.beginPath();
      gfx.moveTo(a.x, a.y);
      gfx.lineTo(b.x, b.y);
      gfx.strokePath();
    }
  }

  /** フェリー航路：破線＋中点に⛴マーカー。 */
  private drawFerryRoutes(): void {
    const gfx = this.scene.add.graphics();
    gfx.lineStyle(2.5, HEX.candyTeal, 0.8);
    for (const route of ROUTES) {
      const a = CITY_BY_ID[route.from];
      const b = CITY_BY_ID[route.to];
      if (!a || !b || !this.isFerry(a, b)) continue;
      this.dashedLine(gfx, a.x, a.y, b.x, b.y, 16, 12);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const m = this.scene.add
        .text(mx, my, '⛴', { fontSize: '22px' })
        .setOrigin(0.5);
      this.container.add(m);
      this.ferryMarkers.push(m);
    }
    this.applyGlow(gfx, HEX.candyTeal, 2);
    this.ferryGfx = gfx;
    this.container.add(gfx);
  }

  /** 破線を引く。 */
  private dashedLine(
    gfx: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dash: number,
    gap: number,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    let pos = 0;
    while (pos < len) {
      const s = pos;
      const e = Math.min(pos + dash, len);
      gfx.beginPath();
      gfx.moveTo(x1 + ux * s, y1 + uy * s);
      gfx.lineTo(x1 + ux * e, y1 + uy * e);
      gfx.strokePath();
      pos += dash + gap;
    }
  }

  private setupOwnedRoutes(): void {
    for (const p of useGameStore.getState().players) {
      const gfx = this.scene.add.graphics();
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      this.applyGlow(gfx, color, 4);
      this.ownedRouteGfxById.set(p.id, gfx);
      this.container.add(gfx);
    }
  }

  private refreshOwnedRoutes(s: GameStore): void {
    const ownerOf = (cityId: string): string | null =>
      s.branches[cityId]?.ownerId ?? null;
    for (const p of s.players) {
      const gfx = this.ownedRouteGfxById.get(p.id);
      if (!gfx) continue;
      gfx.clear();
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      gfx.lineStyle(3, color, 0.95);
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

  /** 全ノードを 1 枚の Graphics にバッチ描画（350駅でも軽量）。 */
  private drawNodes(): void {
    const g = this.scene.add.graphics();
    const r = MapLayer.NODE_RADIUS;
    for (const c of CITIES) {
      const color = CITY_TYPE_COLOR[c.type] ?? HEX.offWhite;
      g.fillStyle(HEX.midnightNavy, 0.9);
      g.fillCircle(c.x, c.y, r);
      g.lineStyle(2, color, 1);
      g.strokeCircle(c.x, c.y, r);
      g.fillStyle(color, 1);
      g.fillCircle(c.x, c.y, r * 0.45);
    }
    this.applyGlow(g, HEX.telegraphBlue, 1.2);
    this.nodesGfx = g;
    this.container.add(g);
  }

  /**
   * 駅名ラベルを描く。主要駅（人口しきい値以上）は常時表示、
   * それ以外（minor）はズームイン時のみ表示（LOD）。
   */
  private drawLabels(): void {
    const r = MapLayer.NODE_RADIUS;
    for (const c of CITIES) {
      const major = (c.population ?? 0) >= MapLayer.LABEL_POP;
      const t = this.scene.add.text(c.x, c.y + r + 3, c.name, {
        fontFamily: FONTS.sans,
        fontSize: major ? '13px' : '11px',
        color: major ? '#f3f1ff' : '#c9cdf0',
        fontStyle: major ? 'bold' : 'normal',
      });
      t.setOrigin(0.5, 0);
      t.setShadow(0, 0, '#0a0e1a', 5, true, true);
      this.container.add(t);
      if (major) {
        this.labels.push(t);
      } else {
        t.setVisible(false);
        this.minorLabels.push(t);
      }
    }
  }

  /** ズーム倍率に応じて minor 駅ラベルの表示/非表示を切り替える（LOD）。 */
  applyLOD(zoom: number): void {
    const show = zoom >= MapLayer.LOD_ZOOM;
    if (show === this.minorVisible) return;
    this.minorVisible = show;
    for (const t of this.minorLabels) t.setVisible(show);
  }

  private applyGlow(
    obj: Phaser.GameObjects.Graphics,
    color: number,
    outerStrength: number,
  ): void {
    if (this.scene.game.renderer.type !== Phaser.WEBGL) return;
    const fx = (obj as Phaser.GameObjects.Components.FX & typeof obj).postFX;
    if (!fx?.addGlow) return;
    fx.addGlow(color, outerStrength, 0, false, 0.1, 12);
  }

  destroy(): void {
    this.unsubscribe?.();
    this.landGfx?.destroy();
    this.coastGfx?.destroy();
    this.routeGfx?.destroy();
    this.nodesGfx?.destroy();
    this.ferryGfx?.destroy();
    this.ferryMarkers.forEach((t) => t.destroy());
    this.labels.forEach((t) => t.destroy());
    this.minorLabels.forEach((t) => t.destroy());
    this.ownedRouteGfxById.forEach((g) => g.destroy());
    this.ownedRouteGfxById.clear();
    this.container.destroy();
  }
}
