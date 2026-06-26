import Phaser from 'phaser';

/**
 * 実装設計書 4. Phaser シーン構成 - BootScene。
 * アセット読み込み・初期化を担う。現状はアセット未使用のため
 * フォント描画の安定化後すぐ GameScene へ遷移する。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // 将来：マップ画像・コマスプライト・SE/BGM をここで読み込む
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
