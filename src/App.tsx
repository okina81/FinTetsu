import { PhaserContainer } from '@/components/PhaserContainer';
import { useGameStore, MAX_TURN } from '@/store/gameStore';
import { CITY_BY_ID } from '@/game/mapData';

/**
 * 実装設計書 3-1 メインゲーム画面レイアウト + Step 5–6 のゲームループ UI。
 *
 * 上部バー（ターン/景気）、Phaser マップ、右 HUD（プレイヤー資産）、
 * 下部アクションバー（サイコロ／ターン終了）を Zustand ストアに接続する。
 */
export default function App() {
  const turn = useGameStore((s) => s.turn);
  const phase = useGameStore((s) => s.phase);
  const dice = useGameStore((s) => s.dice);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const optionCount = useGameStore((s) => s.options.length);
  const rollDice = useGameStore((s) => s.rollDice);
  const endTurn = useGameStore((s) => s.endTurn);

  const me = players[currentPlayerIndex];
  const city = CITY_BY_ID[me.position];

  return (
    <div className="flex h-full w-full flex-col bg-midnight-navy text-off-white">
      {/* トップバー */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-2.5">
        <h1 className="font-display text-xl font-bold text-finance-gold">
          FinTetsu<span className="ml-2 text-sm text-smoke-gray">フィン鉄</span>
        </h1>
        <div className="flex items-center gap-6 text-sm">
          <span className="font-data text-smoke-gray">
            ターン{' '}
            <span className="text-off-white">
              {turn}
            </span>
            /{MAX_TURN}
          </span>
          <span className="flex items-center gap-2 text-smoke-gray">
            景気
            <span className="font-data tracking-widest text-telegraph-blue">
              ███░░
            </span>
            <span className="text-off-white">普通</span>
          </span>
        </div>
      </header>

      {/* 中央：マップ + 右パネル */}
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <PhaserContainer />
        </main>

        <aside className="hidden w-72 shrink-0 flex-col gap-3 border-l border-white/10 p-4 lg:flex">
          <section>
            <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-smoke-gray">
              プレイヤーHUD
            </h2>
            <div
              className="rounded-lg border bg-map-ground p-3"
              style={{ borderColor: me.color }}
            >
              <div className="flex items-center justify-between text-sm">
                <span>🏦 {me.name}</span>
                <span className="font-data text-xs text-smoke-gray">
                  現在地: {city?.name ?? '—'}
                </span>
              </div>
              <div className="font-data text-lg text-finance-gold">
                {formatMan(me.cash)}
              </div>
              <div className="font-data text-xs text-market-red">
                借入 {formatMan(me.debt)}
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-smoke-gray">
              支店一覧
            </h2>
            <p className="text-xs text-smoke-gray">まだ支店がありません</p>
          </section>

          <section>
            <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-smoke-gray">
              手持ちカード
            </h2>
            <p className="text-xs text-smoke-gray">—</p>
          </section>
        </aside>
      </div>

      {/* アクションバー */}
      <footer className="flex items-center gap-4 border-t border-white/10 px-5 py-3">
        <DiceButton phase={phase} dice={dice} onRoll={rollDice} />

        <StatusLine phase={phase} dice={dice} optionCount={optionCount} />

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            disabled={phase !== 'action'}
            onClick={endTurn}
            className={
              phase === 'action'
                ? 'rounded-lg bg-finance-gold px-4 py-2 text-sm font-bold text-midnight-navy transition hover:brightness-110'
                : 'cursor-not-allowed rounded-lg border border-white/15 px-4 py-2 text-sm text-off-white opacity-40'
            }
          >
            ターン終了 ▶
          </button>
        </div>
      </footer>
    </div>
  );
}

/** サイコロボタン。roll フェーズのみ有効。出目を表示する。 */
function DiceButton({
  phase,
  dice,
  onRoll,
}: {
  phase: string;
  dice: number | null;
  onRoll: () => void;
}) {
  const enabled = phase === 'roll';
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onRoll}
      className={
        enabled
          ? 'rounded-lg bg-finance-gold px-4 py-2 text-sm font-bold text-midnight-navy transition hover:brightness-110'
          : 'cursor-not-allowed rounded-lg bg-finance-gold/90 px-4 py-2 text-sm font-bold text-midnight-navy opacity-50'
      }
    >
      🎲 サイコロを振る
      {dice != null && (
        <span className="font-data ml-2 rounded bg-midnight-navy/30 px-1.5">
          {dice}
        </span>
      )}
    </button>
  );
}

/** フェーズに応じた案内テキスト。 */
function StatusLine({
  phase,
  dice,
  optionCount,
}: {
  phase: string;
  dice: number | null;
  optionCount: number;
}) {
  let text = '';
  switch (phase) {
    case 'roll':
      text = 'サイコロを振って移動しよう';
      break;
    case 'select':
      text = `${dice} が出た！ 光っている都市（${optionCount}）から移動先を選択`;
      break;
    case 'moving':
      text = '移動中…';
      break;
    case 'action':
      text = '到着！ ターンを終了して次へ';
      break;
  }
  return <span className="text-sm text-smoke-gray">{text}</span>;
}

/** 円を「万」単位で表示（証券画面風にモノスペース）。 */
function formatMan(yen: number): string {
  const man = Math.round(yen / 10000);
  return `¥${man.toLocaleString('ja-JP')}万`;
}
