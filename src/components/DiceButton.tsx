import { useEffect, useRef, useState } from 'react';

/**
 * サイコロボタン＋実際に振る3Dアニメーション。
 *
 * クリックすると画面中央に 3D のサイコロが転がり（多軸回転）、
 * 確定した出目の面が正面を向いて着地する。出目は onRoll() が返す値。
 * CSS 3D（preserve-3d）で実装し、音源/Phaser に依存しない。
 */

const SIZE = 96; // px
const HALF = SIZE / 2;
const TUMBLE_MS = 850;
const SETTLE_MS = 700;

/** 各面のピップ配置（3x3 グリッドの埋めるセル）。 */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** 立方体の各面の配置（value → その面を作る transform）。 */
const FACES: { value: number; transform: string }[] = [
  { value: 1, transform: `translateZ(${HALF}px)` },
  { value: 6, transform: `rotateY(180deg) translateZ(${HALF}px)` },
  { value: 3, transform: `rotateY(90deg) translateZ(${HALF}px)` },
  { value: 4, transform: `rotateY(-90deg) translateZ(${HALF}px)` },
  { value: 2, transform: `rotateX(90deg) translateZ(${HALF}px)` },
  { value: 5, transform: `rotateX(-90deg) translateZ(${HALF}px)` },
];

/** 出目を正面に向ける最終回転。 */
const LAND: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  6: 'rotateY(180deg)',
  3: 'rotateY(-90deg)',
  4: 'rotateY(90deg)',
  2: 'rotateX(-90deg)',
  5: 'rotateX(90deg)',
};

function Pip() {
  return <span className="block h-3 w-3 rounded-full bg-midnight-navy" />;
}

function DieFace({ value, transform }: { value: number; transform: string }) {
  const filled = new Set(PIPS[value]);
  return (
    <div
      className="absolute grid grid-cols-3 grid-rows-3 place-items-center rounded-2xl border-4 border-midnight-navy bg-finance-gold p-2"
      style={{
        width: SIZE,
        height: SIZE,
        transform,
        backfaceVisibility: 'hidden',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex h-3 w-3 items-center justify-center">
          {filled.has(i) ? <Pip /> : null}
        </span>
      ))}
    </div>
  );
}

export function DiceButton({
  enabled,
  dice,
  onRoll,
}: {
  enabled: boolean;
  dice: number | null;
  onRoll: () => number;
}) {
  const [rolling, setRolling] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const handleClick = () => {
    if (!enabled || rolling) return;
    setRolling(true);
    setLanded(null);
    timers.current.push(
      setTimeout(() => {
        const value = onRoll(); // 実際の出目を確定
        setLanded(value);
      }, TUMBLE_MS),
    );
    timers.current.push(
      setTimeout(() => {
        setRolling(false);
        setLanded(null);
      }, TUMBLE_MS + SETTLE_MS),
    );
  };

  const active = enabled && !rolling;

  return (
    <>
      <button
        type="button"
        disabled={!active}
        onClick={handleClick}
        className={
          active
            ? 'rounded-pop bg-finance-gold px-5 py-2 text-sm font-bold text-midnight-navy shadow-pop transition hover:brightness-110 active:translate-y-0.5'
            : 'cursor-not-allowed rounded-pop bg-finance-gold/80 px-5 py-2 text-sm font-bold text-midnight-navy opacity-60'
        }
      >
        🎲 サイコロをふる
        {dice != null && !rolling && (
          <span
            key={dice}
            className="font-data ml-2 inline-block animate-dice-pop rounded-md bg-midnight-navy/30 px-1.5"
          >
            {dice}
          </span>
        )}
      </button>

      {rolling && (
        <div
          data-dice-overlay="true"
          className="pointer-events-none fixed inset-0 z-[55] grid place-items-center"
        >
          <div style={{ perspective: 600 }}>
            <div
              className={landed == null ? 'animate-dice-tumble' : ''}
              style={{
                width: SIZE,
                height: SIZE,
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform:
                  landed == null
                    ? undefined
                    : `rotateX(-18deg) rotateY(18deg) ${LAND[landed]}`,
                transition:
                  landed == null
                    ? undefined
                    : 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              {FACES.map((f) => (
                <DieFace
                  key={f.value}
                  value={f.value}
                  transform={f.transform}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
