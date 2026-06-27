import Phaser from 'phaser';
import { MapLayer } from '../layers/MapLayer';
import { HEX, FONTS } from '../theme';

/**
 * 実装設計書 4. Phaser シーン構成 - GameScene（メインゲームループ）。
 *
 * 現段階（Step 3）では MapLayer による地図・路線描画までを担当する。
 * 後続ステップで PieceLayer / UILayer / EffectLayer を重ねていく。
 */
export class GameScene extends Phaser.Scene {
  private mapLayer?: MapLayer;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(HEX.mapGround);

    this.drawTitleWatermark();

    this.mapLayer = new MapLayer(this);

    // 都市クリックは後続ステップでポップアップ表示に接続する
    this.events.on('city:click', (cityId: string) => {
      // eslint-disable-next-line no-console
      console.debug('[GameScene] city clicked:', cityId);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
