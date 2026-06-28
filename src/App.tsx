import { useEffect, useRef, useState } from 'react';
import { PhaserContainer } from '@/components/PhaserContainer';
import {
  useGameStore,
  MAX_TURN,
  formatMan,
  economyLabel,
} from '@/store/gameStore';
import { useCpuController } from '@/hooks/useCpuController';
import { CITY_BY_ID } from '@/game/mapData';
import { BRANCH_SPECS } from '@/game/branchSpec';
import type { Player } from '@/game/types';

/**
 * 実装設計書 3-1 メイン画面 + Step 5–7 のゲームループ UI。
 * 上部バー / Phaser マップ / 右 HUD（全プレイヤー資産・支店一覧）/
 * 下部アクションバー（サイコロ・支店設立/強化・ターン終了）を
 * Zustand ストアに接続し、CPU の番は useCpuController が自動進行する。
 */
export default function App() {
  useCpuController();

  const turn = useGameStore((s) => s.turn);
  const phase = useGameStore((s) => s.phase);
  const players = useGameStore((s) => s.players);
  const branches = useGameStore((s) => s.branches);
  const develop = useGameStore((s) => s.develop);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const totalAssets = useGameStore((s) => s.totalAssets);
  const started = useGameStore((s) => s.started);

  return (
    <div className="flex h-full w-full flex-col bg-midnight-navy text-off-white">
      {/* トップバー */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-2.5">
        <h1 className="font-display text-xl font-bold text-finance-gold">
          FinTetsu<span className="ml-2 text-sm text-smoke-gray">フィン鉄</span>
        </h1>
        <div className="flex items-center gap-6 text-sm">
          <span className="font-data text-smoke-gray">
            ターン <span className="text-off-white">{turn}</span>/{MAX_TURN}
          </span>
          <EconomyGauge />
        </div>
      </header>

      {/* 中央：マップ + 右パネル */}
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <PhaserContainer />
        </main>

        <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/10 p-4 lg:flex">
          <section>
            <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-smoke-gray">
              プレイヤー
            </h2>
            <div className="flex flex-col gap-2">
              {players.map((p, i) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  assets={totalAssets(p.id)}
                  active={i === currentPlayerIndex}
                />
              ))}
            </div>
          </section>

          <BranchList ownerId="p1" branches={branches} develop={develop} />
        </aside>
      </div>

      <ActionBar />

      {phase === 'event' && <EventModal />}
      {phase === 'gameover' && <ResultOverlay />}
      {!started && <TitleOverlay />}
    </div>
  );
}

/** イベントカード演出モーダル（設計書 3-3）。 */
function EventModal() {
  const card = useGameStore((s) => s.activeCard);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const applyEventCard = useGameStore((s) => s.applyEventCard);
  if (!card) return null;

  const me = players[currentPlayerIndex];
  const theme = {
    chance: { icon: '🎴', label: 'チャンス！', color: '#4caf50' },
    happening: { icon: '💀', label: 'ハプニング発生！', color: '#ff4d6d' },
    regional: { icon: '🏙️', label: '地域経済ニュース', color: '#00b4d8' },
  }[card.category];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-navy/80 backdrop-blur-sm">
      <div
        className="w-[420px] rounded-2xl border bg-map-ground p-6 text-center shadow-2xl"
        style={{ borderColor: theme.color }}
      >
        <p
          className="mb-4 font-display text-lg font-bold"
          style={{ color: theme.color }}
        >
          {theme.icon} {theme.label}
        </p>
        <div
          className="rounded-xl border border-white/10 bg-midnight-navy/60 p-5"
          style={{ boxShadow: `0 0 24px ${theme.color}33` }}
        >
          <div className="mb-2 text-4xl">{theme.icon}</div>
          <h3 className="font-display text-xl font-bold text-off-white">
            {card.title}
          </h3>
          <p className="mt-2 text-sm text-smoke-gray">{card.description}</p>
        </div>
        <button
          type="button"
          disabled={me?.isCpu}
          onClick={applyEventCard}
          className={
            me?.isCpu
              ? 'mt-5 w-full cursor-not-allowed rounded-lg border border-white/15 px-4 py-2.5 text-sm text-smoke-gray'
              : 'mt-5 w-full rounded-lg bg-finance-gold px-4 py-2.5 text-sm font-bold text-midnight-navy transition hover:brightness-110'
          }
        >
          {me?.isCpu ? `${me.name} が確認中…` : '確認する'}
        </button>
      </div>
    </div>
  );
}

/** プレイヤー資産カード。現在手番は枠を光らせる。 */
function PlayerCard({
  player,
  assets,
  active,
}: {
  player: Player;
  assets: number;
  active: boolean;
}) {
  const city = CITY_BY_ID[player.position];
  return (
    <div
      className="rounded-lg border bg-map-ground p-2.5 transition"
      style={{
        borderColor: active ? player.color : 'rgba(255,255,255,0.08)',
        boxShadow: active ? `0 0 12px ${player.color}66` : 'none',
      }}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: player.color }}
          />
          {player.isCpu ? '👤' : '🏦'} {player.name}
        </span>
        <span className="font-data text-[11px] text-smoke-gray">
          {city?.name ?? '—'}
        </span>
      </div>
      <div className="font-data text-base text-finance-gold">
        {formatMan(assets)}
      </div>
      <div className="font-data text-[11px] text-smoke-gray">
        現金 {formatMan(player.cash)}
      </div>
    </div>
  );
}

/** 指定プレイヤーの支店一覧。 */
function BranchList({
  ownerId,
  branches,
  develop,
}: {
  ownerId: string;
  branches: Record<string, { ownerId: string; level: 1 | 2 | 3 | 4 | 5 }>;
  develop: Record<string, number>;
}) {
  const owned = Object.entries(branches).filter(
    ([, b]) => b.ownerId === ownerId,
  );
  return (
    <section>
      <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-smoke-gray">
        支店一覧（あなた）
      </h2>
      {owned.length === 0 ? (
        <p className="text-xs text-smoke-gray">まだ支店がありません</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {owned.map(([cid, b]) => {
            const spec = BRANCH_SPECS[b.level];
            return (
              <li
                key={cid}
                className="flex items-center justify-between rounded bg-white/5 px-2 py-1 text-xs"
              >
                <span>
                  {CITY_BY_ID[cid]?.name}{' '}
                  <span className="text-smoke-gray">
                    Lv{b.level} {spec.name}
                  </span>
                  {develop[cid] > 0 && (
                    <span className="ml-1 text-player-3">
                      {'🌱'.repeat(Math.min(develop[cid], 3))}
                    </span>
                  )}
                </span>
                <span className="font-data text-finance-gold">
                  {formatMan(spec.revenue)}/T
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 下部アクションバー。人間の手番のみ操作可能。 */
function ActionBar() {
  const phase = useGameStore((s) => s.phase);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const dice = useGameStore((s) => s.dice);
  const message = useGameStore((s) => s.message);
  const rollDice = useGameStore((s) => s.rollDice);
  const endTurn = useGameStore((s) => s.endTurn);
  const buildBranch = useGameStore((s) => s.buildBranch);
  const upgradeBranch = useGameStore((s) => s.upgradeBranch);
  const developCity = useGameStore((s) => s.developCity);
  const actionAt = useGameStore((s) => s.actionAt);

  const me = players[currentPlayerIndex];
  const isHuman = !me?.isCpu && phase !== 'gameover';
  const a = actionAt(me?.id ?? '');

  const primary =
    'rounded-lg bg-finance-gold px-4 py-2 text-sm font-bold text-midnight-navy transition hover:brightness-110';
  const disabled =
    'cursor-not-allowed rounded-lg border border-white/15 px-4 py-2 text-sm text-off-white opacity-40';
  const ghost =
    'rounded-lg border border-finance-gold/60 px-4 py-2 text-sm text-finance-gold transition hover:bg-finance-gold/10';

  return (
    <footer className="flex items-center gap-3 border-t border-white/10 px-5 py-3">
      <DiceButton
        enabled={isHuman && phase === 'roll'}
        dice={dice}
        onRoll={rollDice}
      />

      {isHuman && phase === 'action' && a.canBuild && (
        <button type="button" onClick={buildBranch} className={ghost}>
          🏗️ 支店を設立 {formatMan(a.buildCost)}
        </button>
      )}
      {isHuman && phase === 'action' && a.canUpgrade && (
        <button type="button" onClick={upgradeBranch} className={ghost}>
          ⬆️ 支店を強化 {formatMan(a.upgradeCost)}
        </button>
      )}
      {isHuman && phase === 'action' && a.canDevelop && (
        <button type="button" onClick={developCity} className={ghost}>
          🌱 地域育成 {formatMan(a.developCost)}
        </button>
      )}

      <span className="min-w-0 flex-1 truncate text-sm text-smoke-gray">
        {me?.isCpu && phase !== 'gameover' ? `🤖 ${me.name} 思考中…` : message}
      </span>

      <button
        type="button"
        disabled={!(isHuman && phase === 'action')}
        onClick={endTurn}
        className={isHuman && phase === 'action' ? primary : disabled}
      >
        ターン終了 ▶
      </button>
    </footer>
  );
}

/** 景気ゲージ（1 不況 〜 5 好況）。収益への影響を色で示す。 */
function EconomyGauge() {
  const economy = useGameStore((s) => s.economy);
  const label = economyLabel(economy);
  const color =
    economy <= 2
      ? 'text-market-red'
      : economy >= 4
        ? 'text-player-3'
        : 'text-telegraph-blue';
  return (
    <span className="flex items-center gap-2 text-smoke-gray">
      景気
      <span className={`font-data tracking-widest ${color}`}>
        {'█'.repeat(economy)}
        {'░'.repeat(5 - economy)}
      </span>
      <span className="text-off-white">{label}</span>
    </span>
  );
}

/**
 * サイコロボタン。クリックで出目をスロット風に回し、確定時にバウンス。
 * 実装設計書 3-4 の出目演出を React 側で表現する。
 */
function DiceButton({
  enabled,
  dice,
  onRoll,
}: {
  enabled: boolean;
  dice: number | null;
  onRoll: () => void;
}) {
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState(dice ?? 1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleClick = () => {
    if (!enabled || rolling) return;
    setRolling(true);
    intervalRef.current = setInterval(() => {
      setFace(1 + Math.floor(Math.random() * 6));
    }, 70);
    window.setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRolling(false);
      onRoll(); // 演出のあとに実際の出目を確定
    }, 650);
  };

  const shown = rolling ? face : dice;
  const active = enabled || rolling;

  return (
    <button
      type="button"
      disabled={!active}
      onClick={handleClick}
      className={
        active
          ? 'rounded-lg bg-finance-gold px-4 py-2 text-sm font-bold text-midnight-navy transition hover:brightness-110'
          : 'cursor-not-allowed rounded-lg bg-finance-gold/90 px-4 py-2 text-sm font-bold text-midnight-navy opacity-50'
      }
    >
      🎲 サイコロを振る
      {shown != null && (
        <span
          key={`${rolling}-${shown}`}
          className={`font-data ml-2 inline-block rounded bg-midnight-navy/30 px-1.5 ${
            rolling ? 'animate-dice-spin' : 'animate-dice-pop'
          }`}
        >
          {shown}
        </span>
      )}
    </button>
  );
}

/** タイトル画面。ゲーム開始までマップ上に重ねる。 */
function TitleOverlay() {
  const startGame = useGameStore((s) => s.startGame);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-midnight-navy/85 backdrop-blur-sm">
      <p className="mb-2 font-data text-xs tracking-[0.3em] text-telegraph-blue">
        BANK ﹡ RAIL ﹡ JAPAN
      </p>
      <h1 className="animate-title-glow font-display text-6xl font-bold text-finance-gold">
        FinTetsu
      </h1>
      <p className="mt-1 font-display text-2xl text-off-white">フィン鉄</p>
      <p className="mt-5 max-w-md text-center text-sm leading-relaxed text-smoke-gray">
        日本全国を巡り、銀行支店を買収・経営して
        <br />
        地域経済を育て、資産日本一を目指せ。
      </p>
      <button
        type="button"
        onClick={startGame}
        className="mt-8 rounded-xl bg-finance-gold px-8 py-3 text-base font-bold text-midnight-navy shadow-lg transition hover:brightness-110"
      >
        ゲーム開始 ▶
      </button>
      <p className="mt-6 font-data text-[11px] text-smoke-gray">
        あなた + CPU銀行 3行 ／ 100ターン or 総資産1億円で決着
      </p>
    </div>
  );
}

/** ゲーム終了時の結果オーバーレイ（資産ランキング）。 */
function ResultOverlay() {
  const players = useGameStore((s) => s.players);
  const winnerId = useGameStore((s) => s.winnerId);
  const totalAssets = useGameStore((s) => s.totalAssets);
  const reset = useGameStore((s) => s.reset);

  const ranking = [...players].sort(
    (x, y) => totalAssets(y.id) - totalAssets(x.id),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-navy/80 backdrop-blur-sm">
      <div className="w-[420px] rounded-2xl border border-finance-gold/40 bg-map-ground p-6 shadow-2xl">
        <h2 className="mb-1 text-center font-display text-2xl font-bold text-finance-gold">
          🏆 ゲーム終了
        </h2>
        <p className="mb-4 text-center text-sm text-smoke-gray">
          勝者は {players.find((p) => p.id === winnerId)?.name}
        </p>
        <ol className="flex flex-col gap-2">
          {ranking.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{
                backgroundColor:
                  p.id === winnerId ? `${p.color}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${p.id === winnerId ? p.color : 'transparent'}`,
              }}
            >
              <span className="flex items-center gap-2">
                <span className="font-data text-smoke-gray">{i + 1}位</span>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </span>
              <span className="font-data text-finance-gold">
                {formatMan(totalAssets(p.id))}
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={reset}
          className="mt-5 w-full rounded-lg bg-finance-gold px-4 py-2.5 text-sm font-bold text-midnight-navy transition hover:brightness-110"
        >
          もう一度プレイ
        </button>
      </div>
    </div>
  );
}
