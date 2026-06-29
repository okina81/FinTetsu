import Phaser from 'phaser';
import { MapLayer } from '../layers/MapLayer';
import { PieceLayer } from '../layers/PieceLayer';
import { HEX, FONTS } from '../theme';
import { CITIES, CITY_BY_ID, BOARD_W, BOARD_H } from '../mapData';
import { useGameStore } from '@/store/gameStore';

/**
 * メインゲームシーン。約350駅の大型ボードを、ドラッグでパン／ホイールで
 * ズームしながら遊ぶ。MapLayer（地図）の上に PieceLayer（コマ）を重ね、
 * ノードのクリック判定・カメラ追従・ラベルLOD・ミニマップを担う。
 */
export class GameScene extends Phaser.Scene {
  private mapLayer?: MapLayer;
  private pieceLayer?: PieceLayer;
  private unsubscribe?: () => void;

  // ミニマップ
  private minimapCam?: Phaser.Cameras.Scene2D.Camera;
  private viewportGfx?: Phaser.GameObjects.Graphics;
  private static readonly MM = { x: 12, w: 170, margin: 12 };

  private static readonly MIN_ZOOM = 0.22;
  private static readonly MAX_ZOOM = 1.6;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(HEX.mapGround);
    cam.setBounds(0, 0, BOARD_W, BOARD_H);

    this.mapLayer = new MapLayer(this);
    this.pieceLayer = new PieceLayer(this);

    const watermark = this.drawTitleWatermark();
    this.setupMinimap(watermark);
    this.setupCameraControls();

    // 開始時は人間プレイヤー周辺をほどよいズームで表示
    const start = CITY_BY_ID[useGameStore.getState().players[0].position];
    cam.setZoom(0.6);
    if (start) cam.centerOn(start.x, start.y);
    this.mapLayer.applyLOD(cam.zoom);

    // カメラ追従＋ジュース（手番開始/到着でパン、イベント等でシェイク）
    let prevPhase = useGameStore.getState().phase;
    let prevIdx = useGameStore.getState().currentPlayerIndex;
    this.unsubscribe = useGameStore.subscribe((s) => {
      const me = s.players[s.currentPlayerIndex];
      const pos = CITY_BY_ID[me.position];
      if (s.currentPlayerIndex !== prevIdx && pos) {
        cam.pan(pos.x, pos.y, 450, 'Sine.easeInOut');
      }
      if (s.phase !== prevPhase) {
        if (s.phase === 'event') cam.shake(180, 0.006);
        else if (s.phase === 'gameover') cam.shake(400, 0.01);
        else if (prevPhase === 'moving' && s.phase === 'action') {
          if (pos) cam.pan(pos.x, pos.y, 350, 'Sine.easeInOut');
          if (s.message.includes('利用料')) cam.shake(220, 0.008);
        }
        prevPhase = s.phase;
      }
      prevIdx = s.currentPlayerIndex;
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      this.pieceLayer?.destroy();
      this.pieceLayer = undefined;
      this.mapLayer?.destroy();
      this.mapLayer = undefined;
    });
  }

  /** 毎フレーム：ミニマップ上の現在表示範囲インジケータを更新。 */
  update(): void {
    if (!this.viewportGfx) return;
    const v = this.cameras.main.worldView;
    const z = this.minimapCam?.zoom ?? 0.08;
    this.viewportGfx.clear();
    this.viewportGfx.lineStyle(Math.max(8, 2 / z), HEX.financeGold, 0.9);
    this.viewportGfx.strokeRect(v.x, v.y, v.width, v.height);
  }

  /** 左下にミニマップ（盤面全体）を表示する第2カメラ。 */
  private setupMinimap(watermark: Phaser.GameObjects.Text): void {
    const { x, w, margin } = GameScene.MM;
    const h = Math.round((w * BOARD_H) / BOARD_W);
    const y = this.scale.height - h - margin;

    // 表示範囲インジケータ（ワールド座標・メインカメラからは隠す）
    this.viewportGfx = this.add.graphics().setDepth(900);

    // ミニマップカメラ
    const mm = this.cameras.add(x, y, w, h);
    mm.setBounds(0, 0, BOARD_W, BOARD_H);
    mm.setZoom(w / BOARD_W);
    mm.centerOn(BOARD_W / 2, BOARD_H / 2);
    mm.setBackgroundColor(0x0c1020);
    this.minimapCam = mm;

    // フレーム（画面固定・メインカメラのみ）
    const frame = this.add.graphics().setScrollFactor(0).setDepth(901);
    frame.lineStyle(3, HEX.telegraphBlue, 0.9);
    frame.strokeRoundedRect(x, y, w, h, 8);

    // カメラごとの描き分け：メインは枠とウォーターマーク、ミニマップは範囲枠
    this.cameras.main.ignore(this.viewportGfx);
    mm.ignore([frame, watermark]);
  }

  /** ドラッグでパン、ホイールでズーム、軽いタップで駅を選択。ミニマップで一気に移動。 */
  private setupCameraControls(): void {
    const cam = this.cameras.main;
    let dragging = false;
    let onMinimap = false;
    let moved = 0;

    const inMinimap = (px: number, py: number) => {
      const c = this.minimapCam;
      return (
        !!c &&
        px >= c.x &&
        px <= c.x + c.width &&
        py >= c.y &&
        py <= c.y + c.height
      );
    };
    const jumpFromMinimap = (px: number, py: number) => {
      const c = this.minimapCam;
      if (!c) return;
      const wp = c.getWorldPoint(px, py);
      cam.centerOn(wp.x, wp.y);
    };

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (inMinimap(p.x, p.y)) {
        onMinimap = true;
        jumpFromMinimap(p.x, p.y);
        return;
      }
      dragging = true;
      moved = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (onMinimap) {
        jumpFromMinimap(p.x, p.y);
        return;
      }
      if (!dragging) return;
      const dx = p.x - p.prevPosition.x;
      const dy = p.y - p.prevPosition.y;
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      moved += Math.abs(dx) + Math.abs(dy);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (onMinimap) {
        onMinimap = false;
        return;
      }
      dragging = false;
      if (moved < 8) {
        const wp = cam.getWorldPoint(p.x, p.y);
        const city = this.nearestCity(wp.x, wp.y, 24);
        const st = useGameStore.getState();
        if (!city) {
          st.inspectCity(null); // 空クリックでポップアップを閉じる
        } else if (
          st.phase === 'select' &&
          st.options.some((o) => o.dest === city.id)
        ) {
          st.chooseDestination(city.id); // 移動先として選択
        } else {
          st.inspectCity(city.id); // それ以外は情報ポップアップ
        }
      }
    });
    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        const z = Phaser.Math.Clamp(
          cam.zoom * (dy > 0 ? 0.88 : 1.14),
          GameScene.MIN_ZOOM,
          GameScene.MAX_ZOOM,
        );
        cam.setZoom(z);
        this.mapLayer?.applyLOD(z);
      },
    );
  }

  /** ワールド座標に最も近い駅（しきい値内）を返す。 */
  private nearestCity(x: number, y: number, maxDist: number) {
    let best: (typeof CITIES)[number] | null = null;
    let bestD = maxDist * maxDist;
    for (const c of CITIES) {
      const dx = c.x - x;
      const dy = c.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  private drawTitleWatermark(): Phaser.GameObjects.Text {
    const t = this.add.text(24, 20, 'FinTetsu / フィン鉄', {
      fontFamily: FONTS.display,
      fontSize: '22px',
      color: '#f5c842',
      fontStyle: 'bold',
    });
    t.setAlpha(0.85);
    t.setScrollFactor(0);
    t.setDepth(1000);
    return t;
  }
}
