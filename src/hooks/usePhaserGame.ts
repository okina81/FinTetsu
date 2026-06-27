import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createGame } from '@/game/createGame';

/**
 * 実装設計書 Step 2. Phaser 3 を React に埋め込むための hook。
 *
 * 返した ref を任意の DOM 要素に渡すと、その要素内に Phaser.Game をマウントする。
 * StrictMode による二重マウントや再レンダーでもインスタンスを使い回し、
 * アンマウント時に確実に destroy してキャンバスのリークを防ぐ。
 */
export function usePhaserGame<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    // すでに生成済みなら再生成しない（StrictMode の二重実行対策）
    if (!gameRef.current) {
      gameRef.current = createGame(parent);
      // 開発時のみ：デバッグ／自動テスト用に Phaser.Game を公開する
      if (import.meta.env.DEV) {
        (window as unknown as { __phaserGame?: Phaser.Game }).__phaserGame =
          gameRef.current;
      }
    }

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return { containerRef, gameRef };
}
