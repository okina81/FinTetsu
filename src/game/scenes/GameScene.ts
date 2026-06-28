import Phaser from 'phaser';
import { MapLayer } from '../layers/MapLayer';
import { PieceLayer } from '../layers/PieceLayer';
import { HEX, FONTS } from '../theme';
import { CITIES, CITY_BY_ID, BOARD_W, BOARD_H } from '../mapData';
import { useGameStore } from '@/store/gameStore';

/**
 * メインゲームシーン。約350駅の大型ボードを、ドラッグでパン／ホイールで
 * ズームしながら遊ぶ。MapLayer（地図）の上に PieceLayer（コマ）を重ね、
 * ノードのクリック判定とカメラ追従を担う。
 */
export class GameScene extends Phaser.Scene {
  private mapLayer?: MapLayer;
  private pieceLayer?: PieceLayer;
  private unsubscribe?: () => void;

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

    this.drawTitleWatermark();
    this.setupCameraControls();

    // 開始時は人間プレイヤー周辺をほどよいズームで表示
    const start = CITY_BY_ID[useGameStore.getState().players[0].position];
    cam.setZoom(0.6);
    if (start) cam.centerOn(start.x, start.y);

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

  /** ドラッグでパン、ホイールでズーム、軽いタップで駅を選択。 */
  private setupCameraControls(): void {
    const cam = this.cameras.main;
    let dragging = false;
    let moved = 0;

    this.input.on('pointerdown', () => {
      dragging = true;
      moved = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      const dx = p.x - p.prevPosition.x;
      const dy = p.y - p.prevPosition.y;
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      moved += Math.abs(dx) + Math.abs(dy);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      dragging = false;
      if (moved < 8) {
        const wp = cam.getWorldPoint(p.x, p.y);
        const city = this.nearestCity(wp.x, wp.y, 24);
        if (city) useGameStore.getState().chooseDestination(city.id);
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

  private drawTitleWatermark(): void {
    const t = this.add.text(24, 20, 'FinTetsu / フィン鉄', {
      fontFamily: FONTS.display,
      fontSize: '22px',
      color: '#f5c842',
      fontStyle: 'bold',
    });
    t.setAlpha(0.85);
    t.setScrollFactor(0);
    t.setDepth(1000);
  }
}
