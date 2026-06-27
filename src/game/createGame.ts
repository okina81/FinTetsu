import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HEX } from './theme';

/** Phaser ワールド（マップ）の論理解像度。マップ座標はこの空間に収まる。 */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 720;

/**
 * Phaser.Game を生成するファクトリ。
 * React の usePhaserGame hook から呼ばれ、指定 DOM へマウントする。
 *
 * ネオングロウ（postFX.addGlow）に WebGL が必須のため renderer は AUTO とし、
 * WebGL を最優先で取得する。
 */
export function createGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO, // WebGL 優先（postFX 利用のため）
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: HEX.midnightNavy,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      // ネオングロウのブルームを鮮明に保つため丸め無効
      roundPixels: false,
    },
    scene: [BootScene, GameScene],
  };

  return new Phaser.Game(config);
}
