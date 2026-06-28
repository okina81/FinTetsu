import { useEffect, useRef, useState } from 'react';

/**
 * 目標値へ向けて表示数値をなめらかに補間するフック（資産・現金の増減演出）。
 * 値が変わるたびに、前の表示値から新しい値へ ease-out で数百ミリ秒かけて遷移する。
 */
export function useCountUp(target: number, durationMs = 450): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const value = Math.round(from + (target - from) * eased);
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      fromRef.current = target; // 中断時は確定値へ
    };
  }, [target, durationMs]);

  return display;
}
