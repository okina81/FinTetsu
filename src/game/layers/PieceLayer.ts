import Phaser from 'phaser';
import { CITY_BY_ID } from '../mapData';
import { HEX } from '../theme';
import { useGameStore } from '@/store/gameStore';
import type { GameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { sfx } from '@/audio/sfx';

/**
 * 実装設計書 4. PieceLayer — プレイヤーのコマ管理。
 *
 * Zustand ストアを購読し：
 *   - 各プレイヤーのコマを現在地に描画
 *   - select フェーズでは移動先候補をゴールドのリングでハイライト
 *   - moving フェーズでは pendingMove の経路に沿ってコマを Tween 移動し、
 *     完了後に store.completeMove() を呼ぶ
 */
export class PieceLayer {
  private scene: Phaser.Scene;
  readonly container: Phaser.GameObjects.Container;

  /** プレイヤーごとのコマ。 */
  private readonly tokenById = new Map<string, Phaser.GameObjects.Container>();
  /** 移動先ハイライトのリング。 */
  private highlights: Phaser.GameObjects.Graphics[] = [];
  /** 支店マーカー（所有者色のリング＋レベルピップ）。 */
  private branchMarkers: Phaser.GameObjects.GameObject[] = [];
  /** ストア購読解除関数。 */
  private unsubscribe?: () => void;
  /** アニメーション中の移動を一度だけ処理するためのガード。 */
  private animating = false;

  private static readonly TOKEN_RADIUS = 11;
  private static readonly STEP_MS = 320;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);

    this.createTokens();
    this.render(useGameStore.getState());

    this.unsubscribe = useGameStore.subscribe((s) => this.render(s));
  }

  /** プレイヤーのコマ（円＋枠＋グロウ）を生成する。 */
  private createTokens(): void {
    const { players } = useGameStore.getState();
    players.forEach((p) => {
      const token = this.scene.add.container(0, 0);
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      const r = PieceLayer.TOKEN_RADIUS;

      const g = this.scene.add.graphics();
      g.fillStyle(0x0a0e1a, 1);
      g.fillCircle(0, 0, r + 2);
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, r);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeCircle(0, 0, r);
      this.applyGlow(g, color, 3);

      token.add(g);
      this.tokenById.set(p.id, token);
      this.container.add(token);
    });
  }

  /** ストア状態に合わせてコマ位置とハイライトを更新する。 */
  private render(s: GameStore): void {
    // コマ位置（移動アニメ中は render では動かさない）
    if (!this.animating) {
      s.players.forEach((p, i) => {
        const token = this.tokenById.get(p.id);
        const city = CITY_BY_ID[p.position];
        if (!token || !city) return;
        const off = this.tokenOffset(i, s.players.length);
        token.setPosition(city.x + off.x, city.y + off.y);
      });
    }

    this.drawBranches(s);
    this.drawHighlights(s);

    // moving フェーズ：未処理の pendingMove があればアニメーション開始
    if (s.phase === 'moving' && s.pendingMove && !this.animating) {
      this.animateMove(s.pendingMove.path);
    }
  }

  /** 所有支店を、所有者色のリング＋レベルピップで都市に描く。 */
  private drawBranches(s: GameStore): void {
    this.clearBranches();
    const colorOf = (ownerId: string) => {
      const owner = s.players.find((p) => p.id === ownerId);
      return owner
        ? Phaser.Display.Color.HexStringToColor(owner.color).color
        : 0xffffff;
    };

    for (const cid in s.branches) {
      const city = CITY_BY_ID[cid];
      if (!city) continue;
      const branch = s.branches[cid];
      const color = colorOf(branch.ownerId);

      // 所有者色のリング（ノードを囲う）
      const ring = this.scene.add.graphics({ x: city.x, y: city.y });
      ring.lineStyle(3, color, 0.95);
      ring.strokeCircle(0, 0, 21);
      this.applyGlow(ring, color, 2.5);
      this.container.add(ring);
      this.branchMarkers.push(ring);

      // レベルピップ（ノード上部に level 個）
      const pips = this.scene.add.graphics();
      const pipW = 5;
      const gap = 2;
      const total = branch.level * pipW + (branch.level - 1) * gap;
      let px = city.x - total / 2;
      const py = city.y - 30;
      pips.fillStyle(color, 1);
      for (let i = 0; i < branch.level; i++) {
        pips.fillRect(px, py, pipW, pipW);
        px += pipW + gap;
      }
      this.container.add(pips);
      this.branchMarkers.push(pips);
    }
  }

  private clearBranches(): void {
    this.branchMarkers.forEach((m) => m.destroy());
    this.branchMarkers = [];
  }

  /** 移動先候補をゴールドのリングでハイライト（パルス付き）。 */
  private drawHighlights(s: GameStore): void {
    this.clearHighlights();
    if (s.phase !== 'select') return;

    for (const opt of s.options) {
      const city = CITY_BY_ID[opt.dest];
      if (!city) continue;
      const ring = this.scene.add.graphics({ x: city.x, y: city.y });
      ring.lineStyle(3, HEX.financeGold, 1);
      ring.strokeCircle(0, 0, 22);
      this.applyGlow(ring, HEX.financeGold, 4);
      this.container.add(ring);
      this.highlights.push(ring);

      this.scene.tweens.add({
        targets: ring,
        scale: { from: 0.85, to: 1.15 },
        alpha: { from: 1, to: 0.5 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  private clearHighlights(): void {
    this.highlights.forEach((h) => {
      this.scene.tweens.killTweensOf(h);
      h.destroy();
    });
    this.highlights = [];
  }

  /** path（cityId 列）に沿って現在プレイヤーのコマを Tween 移動する。 */
  private animateMove(path: string[]): void {
    const store = useGameStore.getState();
    const player = store.players[store.currentPlayerIndex];
    const token = this.tokenById.get(player.id);
    if (!token || path.length < 2) {
      store.completeMove();
      return;
    }

    this.animating = true;
    this.clearHighlights();

    const idx = store.currentPlayerIndex;
    const off = this.tokenOffset(idx, store.players.length);
    const color = Phaser.Display.Color.HexStringToColor(player.color).color;
    // path[0] は現在地。1 個目以降を順に辿る。
    const segments = path.slice(1).map((cid) => {
      const c = CITY_BY_ID[cid];
      return { x: c.x + off.x, y: c.y + off.y };
    });

    // 各セグメントを 1 区間ずつ Tween し、最後に completeMove を呼ぶ。
    // （tweens.chain に依存せず、確実に完了コールバックを発火させる）
    const step = (i: number) => {
      if (i >= segments.length) {
        this.animating = false;
        const last = segments[segments.length - 1];
        this.arrivalEffect(last.x, last.y, color);
        this.bounceToken(token);
        useGameStore.getState().completeMove();
        return;
      }
      const speed = useSettingsStore.getState().gameSpeed || 1;
      sfx.step(); // 1 マスごとの軽いチック
      this.scene.tweens.add({
        targets: token,
        x: segments[i].x,
        y: segments[i].y,
        duration: PieceLayer.STEP_MS / speed,
        ease: 'Sine.inOut',
        onComplete: () => step(i + 1),
      });
    };
    step(0);
  }

  /** 到着エフェクト：プレイヤー色のリングが弾けて消える。 */
  private arrivalEffect(x: number, y: number, color: number): void {
    const ring = this.scene.add.graphics({ x, y });
    ring.lineStyle(3, color, 1);
    ring.strokeCircle(0, 0, 14);
    this.applyGlow(ring, color, 4);
    this.container.add(ring);

    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.4, to: 2.4 },
      alpha: { from: 1, to: 0 },
      duration: 520,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy(),
    });
  }

  /** 着地時のスカッシュ＆ストレッチ（ぷるんと弾む）。 */
  private bounceToken(token: Phaser.GameObjects.Container): void {
    this.scene.tweens.add({
      targets: token,
      scaleX: { from: 1.35, to: 1 },
      scaleY: { from: 0.7, to: 1 },
      duration: 360,
      ease: 'Back.out',
    });
  }

  /** 同一都市で複数コマが重ならないよう、円状に少しずらす。 */
  private tokenOffset(index: number, total: number): { x: number; y: number } {
    if (total <= 1) return { x: 0, y: 0 };
    const angle = (index / total) * Math.PI * 2;
    const radius = 12;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
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
    this.clearHighlights();
    this.clearBranches();
    this.tokenById.forEach((t) => t.destroy());
    this.tokenById.clear();
    this.container.destroy();
  }
}
