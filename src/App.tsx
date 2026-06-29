import { useState } from 'react';
import { PhaserContainer } from '@/components/PhaserContainer';
import {
  useGameStore,
  MAX_TURN,
  formatMan,
  economyLabel,
} from '@/store/gameStore';
import { useCpuController } from '@/hooks/useCpuController';
import { useAudio } from '@/hooks/useAudio';
import { useSettingsStore, GAME_SPEEDS } from '@/store/settingsStore';
import { CITY_BY_ID } from '@/game/mapData';
import { BRANCH_SPECS } from '@/game/branchSpec';
import { CITY_TYPE_LABEL, CITY_TYPE_CSS } from '@/game/theme';
import { CITY_TYPE_INFO } from '@/game/cityType';
import type { CityType } from '@/game/types';
import { Mascot } from '@/components/Mascot';
import { DiceButton } from '@/components/DiceButton';
import { useCountUp } from '@/hooks/useCountUp';
import type { Player } from '@/game/types';

/**
 * 実装設計書 3-1 メイン画面 + Step 5–7 のゲームループ UI。
 * 上部バー / Phaser マップ / 右 HUD（全プレイヤー資産・支店一覧）/
 * 下部アクションバー（サイコロ・支店設立/強化・ターン終了）を
 * Zustand ストアに接続し、CPU の番は useCpuController が自動進行する。
 */
export default function App() {
  useCpuController();
  useAudio();

  const turn = useGameStore((s) => s.turn);
  const phase = useGameStore((s) => s.phase);
  const players = useGameStore((s) => s.players);
  const branches = useGameStore((s) => s.branches);
  const develop = useGameStore((s) => s.develop);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const totalAssets = useGameStore((s) => s.totalAssets);
  const started = useGameStore((s) => s.started);

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-full w-full flex-col bg-midnight-navy text-off-white">
      {/* トップバー */}
      <header className="flex items-center justify-between bg-blueberry-700 px-5 py-2.5 shadow-pop">
        <h1 className="flex items-center gap-2 font-display text-xl text-finance-gold">
          <span className="drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]">
            FinTetsu
          </span>
          <span className="text-sm text-candy-pink">フィン鉄</span>
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="rounded-full bg-blueberry-600 px-3 py-1 font-data text-smoke-gray">
            ターン <span className="text-off-white">{turn}</span>/{MAX_TURN}
          </span>
          <EconomyGauge />
          <button
            type="button"
            aria-label="設定"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full bg-blueberry-600 px-3 py-1.5 text-off-white shadow-pop transition hover:brightness-110 active:translate-y-0.5"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* 中央：マップ + 右パネル */}
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <PhaserContainer />
          {/* 操作ヒント */}
          <div className="pointer-events-none absolute right-3 top-3 rounded-pop bg-blueberry-700/80 px-3 py-1.5 text-[11px] text-smoke-gray">
            🖱️ ドラッグ:移動 ／ ホイール:ズーム ／ 駅クリック:情報
          </div>
          <CityPopup />
        </main>

        <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto bg-blueberry-700/60 p-4 lg:flex">
          <section>
            <h2 className="mb-2 font-display text-sm text-candy-teal">
              👥 プレイヤー
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

          <Legend />
        </aside>
      </div>

      <ActionBar />

      {phase === 'event' && <EventModal />}
      {phase === 'gameover' && <ResultOverlay />}
      {!started && <TitleOverlay />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
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
    chance: { icon: '🎁', label: 'チャンス！', color: '#5fd97a' },
    happening: { icon: '💥', label: 'ハプニング発生！', color: '#ff5d7a' },
    regional: { icon: '🏙️', label: '地域経済ニュース', color: '#3dc6ff' },
  }[card.category];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-navy/80 backdrop-blur-sm">
      <div
        className="w-[420px] animate-card-flip rounded-pop border-4 bg-blueberry-700 p-6 text-center shadow-pop-lg"
        style={{ borderColor: theme.color }}
      >
        <p className="mb-4 font-display text-xl" style={{ color: theme.color }}>
          {theme.icon} {theme.label}
        </p>
        <div
          className="rounded-pop border-2 border-white/10 bg-blueberry-600 p-5"
          style={{ boxShadow: `0 0 24px ${theme.color}44` }}
        >
          <div className="mb-2 text-5xl">{theme.icon}</div>
          <h3 className="font-display text-xl text-off-white">{card.title}</h3>
          <p className="mt-2 text-sm text-smoke-gray">{card.description}</p>
        </div>
        <button
          type="button"
          disabled={me?.isCpu}
          onClick={applyEventCard}
          className={
            me?.isCpu
              ? 'mt-5 w-full cursor-not-allowed rounded-pop bg-blueberry-600 px-4 py-2.5 text-sm font-bold text-smoke-gray'
              : 'mt-5 w-full rounded-pop bg-finance-gold px-4 py-2.5 text-sm font-bold text-midnight-navy shadow-pop transition hover:brightness-110 active:translate-y-0.5'
          }
        >
          {me?.isCpu ? `${me.name} が確認中…` : 'OK！'}
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
  const assetsAnim = useCountUp(assets);
  const cashAnim = useCountUp(player.cash);
  return (
    <div
      className="rounded-pop border-2 bg-blueberry-600 p-2.5 transition"
      style={{
        borderColor: active ? player.color : 'rgba(255,255,255,0.08)',
        boxShadow: active
          ? `0 4px 0 rgba(0,0,0,0.25), 0 0 16px ${player.color}88`
          : '0 4px 0 rgba(0,0,0,0.25)',
        transform: active ? 'translateY(-1px)' : 'none',
      }}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-bold">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
            style={{ backgroundColor: player.color, color: '#1b1d3a' }}
          >
            {player.isCpu ? '🤖' : '🏦'}
          </span>
          {player.name}
        </span>
        <span className="font-data text-[11px] text-smoke-gray">
          {city?.name ?? '—'}
        </span>
      </div>
      <div className="font-data text-lg font-bold text-finance-gold">
        {formatMan(assetsAnim)}
      </div>
      <div className="font-data text-[11px] text-smoke-gray">
        現金 {formatMan(cashAnim)}
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
      <h2 className="mb-2 font-display text-sm text-candy-teal">🏦 支店一覧</h2>
      {owned.length === 0 ? (
        <p className="rounded-pop bg-blueberry-600/60 px-3 py-2 text-xs text-smoke-gray">
          まだ支店がありません
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {owned.map(([cid, b]) => {
            const spec = BRANCH_SPECS[b.level];
            return (
              <li
                key={cid}
                className="flex items-center justify-between rounded-pop bg-blueberry-600 px-3 py-1.5 text-xs shadow-pop"
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

/** 凡例：マスの色と効果（収益倍率・設立費）の対応表。 */
const LEGEND_ORDER: CityType[] = [
  'financial',
  'industrial',
  'tourism',
  'agriculture',
  'rural',
];

function Legend() {
  return (
    <section>
      <h2 className="mb-2 font-display text-sm text-candy-teal">
        🎨 マスの色と効果
      </h2>
      <ul className="flex flex-col gap-1.5">
        {LEGEND_ORDER.map((type) => {
          const info = CITY_TYPE_INFO[type];
          const pct = Math.round((info.revenueMult - 1) * 100);
          const tag = pct === 0 ? '±0%' : `${pct > 0 ? '+' : ''}${pct}%`;
          const tagColor =
            pct > 0 ? '#5fd97a' : pct < 0 ? '#ff5d7a' : '#9aa0c8';
          return (
            <li
              key={type}
              className="rounded-pop bg-blueberry-600 px-2.5 py-1.5 text-xs shadow-pop"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: CITY_TYPE_CSS[type],
                      boxShadow: `0 0 6px ${CITY_TYPE_CSS[type]}99`,
                    }}
                  />
                  {CITY_TYPE_LABEL[type]}
                </span>
                <span className="flex items-center gap-1.5 font-data">
                  <span style={{ color: tagColor }}>収益 {tag}</span>
                  {info.buildMult < 1 && (
                    <span className="text-candy-teal">設立費安</span>
                  )}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-smoke-gray">
                {info.effect}
              </p>
            </li>
          );
        })}
      </ul>
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
    'rounded-pop bg-finance-gold px-4 py-2 text-sm font-bold text-midnight-navy shadow-pop transition hover:brightness-110 active:translate-y-0.5';
  const disabled =
    'cursor-not-allowed rounded-pop bg-blueberry-600 px-4 py-2 text-sm font-bold text-smoke-gray opacity-50';
  const ghost =
    'rounded-pop bg-candy-teal px-4 py-2 text-sm font-bold text-midnight-navy shadow-pop transition hover:brightness-110 active:translate-y-0.5';

  return (
    <footer className="flex items-center gap-3 bg-blueberry-700 px-5 py-3 shadow-[0_-4px_0_rgba(0,0,0,0.2)]">
      <DiceButton
        enabled={isHuman && phase === 'roll'}
        dice={dice}
        onRoll={() => {
          rollDice();
          return useGameStore.getState().dice ?? 1;
        }}
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

/** タイトル画面。ゲーム開始までマップ上に重ねる。 */
function TitleOverlay() {
  const startGame = useGameStore((s) => s.startGame);
  const loadGame = useGameStore((s) => s.loadGame);
  const hasSavedGame = useGameStore((s) => s.hasSavedGame);
  const canResume = hasSavedGame();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-blueberry-700/95 to-midnight-navy/95 backdrop-blur-sm">
      <Mascot
        size={132}
        className="animate-bob drop-shadow-[0_6px_0_rgba(0,0,0,0.25)]"
      />
      <p className="mb-1 mt-4 font-data text-xs tracking-[0.3em] text-candy-teal">
        BANK ﹡ RAIL ﹡ JAPAN
      </p>
      <h1 className="animate-title-glow font-display text-6xl text-finance-gold drop-shadow-[0_4px_0_rgba(0,0,0,0.3)]">
        FinTetsu
      </h1>
      <p className="mt-2 font-display text-2xl text-candy-pink">フィン鉄</p>
      <p className="mt-5 max-w-md text-center text-sm leading-relaxed text-off-white/90">
        日本全国を巡り、銀行支店を買収・経営して
        <br />
        地域経済を育て、資産日本一を目指せ！
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={startGame}
          className="rounded-pop bg-finance-gold px-10 py-3.5 text-lg font-bold text-midnight-navy shadow-pop-lg transition hover:brightness-110 active:translate-y-1"
        >
          {canResume ? '🎮 新しいゲーム' : '🎮 ゲームスタート'}
        </button>
        {canResume && (
          <button
            type="button"
            onClick={() => loadGame()}
            className="rounded-pop bg-candy-teal px-10 py-2.5 text-sm font-bold text-midnight-navy shadow-pop transition hover:brightness-110 active:translate-y-0.5"
          >
            📂 つづきから
          </button>
        )}
      </div>
      <p className="mt-6 rounded-full bg-blueberry-600/70 px-4 py-1 font-data text-[11px] text-smoke-gray">
        あなた + CPU銀行 3行 ／ 100ターン or 総資産1億円で決着
      </p>
    </div>
  );
}

/** 設定 / ポーズモーダル：音量・速度・フルスクリーン・セーブ・タイトル。 */
function SettingsModal({ onClose }: { onClose: () => void }) {
  const started = useGameStore((s) => s.started);
  const phase = useGameStore((s) => s.phase);
  const saveGame = useGameStore((s) => s.saveGame);

  const master = useSettingsStore((s) => s.masterVolume);
  const bgm = useSettingsStore((s) => s.bgmVolume);
  const se = useSettingsStore((s) => s.seVolume);
  const speed = useSettingsStore((s) => s.gameSpeed);
  const setMaster = useSettingsStore((s) => s.setMasterVolume);
  const setBgm = useSettingsStore((s) => s.setBgmVolume);
  const setSe = useSettingsStore((s) => s.setSeVolume);
  const setSpeed = useSettingsStore((s) => s.setGameSpeed);

  const inGame = started && phase !== 'gameover';

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  };

  const quitToTitle = () => {
    useGameStore.setState({ started: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-midnight-navy/80 backdrop-blur-sm">
      <div className="w-[420px] animate-pop-in rounded-pop border-4 border-candy-grape bg-blueberry-700 p-6 shadow-pop-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-finance-gold">⚙ 設定</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-blueberry-600 px-2.5 py-1 text-smoke-gray transition hover:text-off-white active:translate-y-0.5"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <VolumeSlider
            label="マスター音量"
            value={master}
            onChange={setMaster}
          />
          <VolumeSlider label="BGM 音量" value={bgm} onChange={setBgm} />
          <VolumeSlider label="効果音 音量" value={se} onChange={setSe} />

          <div>
            <p className="mb-1.5 text-xs text-smoke-gray">ゲーム速度</p>
            <div className="flex gap-2">
              {GAME_SPEEDS.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSpeed(sp)}
                  className={
                    speed === sp
                      ? 'flex-1 rounded-pop bg-finance-gold py-1.5 text-sm font-bold text-midnight-navy shadow-pop'
                      : 'flex-1 rounded-pop bg-blueberry-600 py-1.5 text-sm font-bold text-off-white transition hover:brightness-110'
                  }
                >
                  ×{sp}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-pop bg-blueberry-600 py-2 text-sm font-bold text-off-white shadow-pop transition hover:brightness-110 active:translate-y-0.5"
          >
            ⛶ フルスクリーン切替
          </button>

          {inGame && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveGame}
                className="flex-1 rounded-pop bg-finance-gold py-2 text-sm font-bold text-midnight-navy shadow-pop transition hover:brightness-110 active:translate-y-0.5"
              >
                💾 セーブ
              </button>
              <button
                type="button"
                onClick={quitToTitle}
                className="flex-1 rounded-pop bg-market-red py-2 text-sm font-bold text-white shadow-pop transition hover:brightness-110 active:translate-y-0.5"
              >
                タイトルへ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 0–1 の音量スライダー。 */
function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-smoke-gray">
        <span>{label}</span>
        <span className="font-data text-off-white">
          {Math.round(value * 100)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-finance-gold"
      />
    </label>
  );
}

/** 都市情報ポップアップ（設計書 3-2）。駅クリックで表示。 */
function CityPopup() {
  const cityId = useGameStore((s) => s.inspectCityId);
  const branches = useGameStore((s) => s.branches);
  const develop = useGameStore((s) => s.develop);
  const players = useGameStore((s) => s.players);
  const inspectCity = useGameStore((s) => s.inspectCity);
  if (!cityId) return null;
  const city = CITY_BY_ID[cityId];
  if (!city) return null;

  const branch = branches[cityId];
  const owner = branch
    ? players.find((p) => p.id === branch.ownerId)
    : undefined;
  const spec = branch ? BRANCH_SPECS[branch.level] : null;
  const dev = develop[cityId] ?? 0;
  const info = CITY_TYPE_INFO[city.type];
  const revPct = Math.round((info.revenueMult - 1) * 100);
  const revTag = revPct === 0 ? '±0%' : `${revPct > 0 ? '+' : ''}${revPct}%`;
  const buildCost = Math.round(BRANCH_SPECS[1].cost * info.buildMult);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 w-72 -translate-x-1/2 animate-pop-in rounded-pop border-2 border-finance-gold/70 bg-blueberry-700 p-4 shadow-pop-lg">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="font-display text-lg text-off-white">{city.name}</h3>
          <span className="flex items-center gap-1.5 text-[11px] text-candy-teal">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: CITY_TYPE_CSS[city.type],
                boxShadow: `0 0 6px ${CITY_TYPE_CSS[city.type]}99`,
              }}
            />
            {CITY_TYPE_LABEL[city.type]}
          </span>
        </div>
        <button
          type="button"
          onClick={() => inspectCity(null)}
          className="rounded-full bg-blueberry-600 px-2 py-0.5 text-smoke-gray transition hover:text-off-white"
        >
          ✕
        </button>
      </div>

      {/* 都市タイプの常時効果（色の意味） */}
      <div className="mb-2 flex items-center justify-between rounded-pop bg-blueberry-600/60 px-3 py-1.5 text-[11px]">
        <span className="text-smoke-gray">{info.effect}</span>
        <span
          className="font-data font-bold"
          style={{
            color: revPct > 0 ? '#5fd97a' : revPct < 0 ? '#ff5d7a' : '#9aa0c8',
          }}
        >
          収益 {revTag}
        </span>
      </div>

      <div className="rounded-pop bg-blueberry-600 px-3 py-2 text-sm">
        {branch && spec ? (
          <>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: owner?.color }}
                />
                {owner?.name ?? '—'}
              </span>
              <span className="font-data text-finance-gold">
                Lv{branch.level} {spec.name}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-smoke-gray">
              <span>収益 / 利用料</span>
              <span className="font-data">
                {formatMan(spec.revenue)} / {formatMan(spec.fee)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between text-xs text-smoke-gray">
            <span>未所有（支店を設立できる）</span>
            <span className="font-data text-finance-gold">
              設立費 {formatMan(buildCost)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-smoke-gray">
        <span>
          人口指数{' '}
          <span className="font-data text-off-white">{city.population}</span>
        </span>
        <span>
          産業活力{' '}
          <span className="font-data text-off-white">{city.industryIndex}</span>
        </span>
        {dev > 0 && (
          <span className="col-span-2 text-leaf-green">
            地域育成 {'🌱'.repeat(Math.min(dev, 3))} (+{dev * 15}% 収益)
          </span>
        )}
      </div>
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

  const winner = players.find((p) => p.id === winnerId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-navy/85 backdrop-blur-sm">
      <div className="w-[440px] animate-pop-in rounded-pop border-4 border-finance-gold bg-blueberry-700 p-6 shadow-pop-lg">
        <div className="mb-2 flex flex-col items-center">
          <Mascot
            size={88}
            color={winner?.color ?? '#ffd44d'}
            className="animate-bob"
          />
          <h2 className="mt-2 font-display text-2xl text-finance-gold">
            🏆 ゲーム終了！
          </h2>
          <p className="text-sm text-off-white">
            勝者は <span className="font-bold">{winner?.name}</span>
          </p>
        </div>
        <ol className="mt-3 flex flex-col gap-2">
          {ranking.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-pop px-3 py-2"
              style={{
                backgroundColor:
                  p.id === winnerId ? `${p.color}26` : 'rgba(255,255,255,0.05)',
                border: `2px solid ${p.id === winnerId ? p.color : 'transparent'}`,
              }}
            >
              <span className="flex items-center gap-2 font-bold">
                <span className="font-data text-smoke-gray">{i + 1}位</span>
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </span>
              <span className="font-data font-bold text-finance-gold">
                {formatMan(totalAssets(p.id))}
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={reset}
          className="mt-5 w-full rounded-pop bg-finance-gold px-4 py-3 text-base font-bold text-midnight-navy shadow-pop transition hover:brightness-110 active:translate-y-0.5"
        >
          🎮 もう一度プレイ
        </button>
      </div>
    </div>
  );
}
