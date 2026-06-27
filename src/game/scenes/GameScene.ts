import Phaser from 'phaser';
import { MapLayer } from '../layers/MapLayer';
import { PieceLayer } from '../layers/PieceLayer';
import { HEX, FONTS } from '../theme';
import { useGameStore } from '@/store/gameStore';

/**
 * 実装設計書 4. Phaser シーン構成 - GameScene（メインゲームループ）。
 *
 * MapLayer（地図・路線）の上に PieceLayer（コマ・移動）を重ね、
 * 都市クリックを移動先選択（Zustand ストア）へ接続する。
 */
export class GameScene extends Phaser.Scene {
  private mapLayer?: MapLayer;
  private pieceLayer?: PieceLayer;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(HEX.mapGround);

    this.drawTitleWatermark();

    this.mapLayer = new MapLayer(this);
    this.pieceLayer = new PieceLayer(this);

    // 都市クリック → select フェーズなら移動先として選択（範囲外はストアが無視）
    this.events.on('city:click', (cityId: string) => {
      useGameStore.getState().chooseDestination(cityId);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pieceLayer?.destroy();
      this.pieceLayer = undefined;
      this.mapLayer?.destroy();
      this.mapLayer = undefined;
    });
  }

  /** マップ隅にうっすらタイトルを刻む（証券板情報風の演出）。 */
  private drawTitleWatermark(): void {
    const t = this.add.text(24, 20, 'FinTetsu / フィン鉄', {
      fontFamily: FONTS.display,
      fontSize: '22px',
      color: '#f5c842',
      fontStyle: 'bold',
    });
    t.setAlpha(0.85);
    t.setScrollFactor(0);
  }
}
