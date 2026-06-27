import { usePhaserGame } from '@/hooks/usePhaserGame';

/**
 * Phaser キャンバスをホストする React コンポーネント。
 * 実装設計書 1 の役割分担に従い、ここから下は Phaser（Canvas）が描画する。
 */
export function PhaserContainer() {
  const { containerRef } = usePhaserGame<HTMLDivElement>();

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-midnight-navy"
      aria-label="FinTetsu マップキャンバス"
    />
  );
}
