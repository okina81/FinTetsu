import { useState } from 'react';
import { Mascot } from '@/components/Mascot';
import { CITY_TYPE_LABEL, CITY_TYPE_CSS } from '@/game/theme';
import { CITY_TYPE_INFO } from '@/game/cityType';
import type { CityType } from '@/game/types';

/**
 * 遊び方ガイド（チュートリアル）。
 * タイトル画面や設定から開ける、ページ送り式のルール・操作説明モーダル。
 * 初回プレイ時は自動表示される（localStorage で既読を管理）。
 */

const LEGEND_ORDER: CityType[] = [
  'financial',
  'industrial',
  'tourism',
  'agriculture',
  'rural',
];

type Page = {
  icon: string;
  title: string;
  body: React.ReactNode;
};

const PAGES: Page[] = [
  {
    icon: '🎯',
    title: 'ゲームの目的',
    body: (
      <>
        あなたは中小企業の社長。全国に出店し、取引を広げて会社を大きくし、
        資産日本一を目指すボードゲームです。
        <ul className="mt-3 flex flex-col gap-1.5 text-left">
          <li>
            🏆 <span className="font-bold text-finance-gold">総資産1億円</span>{' '}
            に最初に到達すれば即勝利
          </li>
          <li>
            ⏳ <span className="font-bold">100ターン</span>{' '}
            終了時に総資産トップでも勝利
          </li>
          <li>🤖 あなた ＋ ライバル社長3人 で競います</li>
        </ul>
      </>
    ),
  },
  {
    icon: '🎲',
    title: 'サイコロを振って移動',
    body: (
      <>
        自分の番が来たら
        <span className="font-bold text-finance-gold">「サイコロをふる」</span>
        。出た目の数だけ進めます。
        <ul className="mt-3 flex flex-col gap-1.5 text-left">
          <li>🟡 光った駅が移動先の候補。クリックで選びます</li>
          <li>🖱️ マップはドラッグで移動、ホイールでズーム</li>
          <li>🔍 駅をクリックすると、その都市の情報が見られます</li>
        </ul>
      </>
    ),
  },
  {
    icon: '🏪',
    title: '出店して会社を育てる',
    body: (
      <>
        止まった駅では、自分の番に拠点（店舗）の経営ができます。
        <ul className="mt-3 flex flex-col gap-1.5 text-left">
          <li>
            🏗️ <span className="font-bold">出店</span>：未出店の駅に拠点を構える
          </li>
          <li>
            ⬆️ <span className="font-bold">強化</span>
            ：自社の拠点を本社（Lv5）まで育てて収益UP
          </li>
          <li>
            🌱 <span className="font-bold">地域育成</span>
            ：費用を払って収益をさらにブースト
          </li>
          <li>
            💸 <span className="font-bold text-market-red">取引額</span>
            ：他社の拠点に止まると仕入れ・利用代金を支払います
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: '⛓️',
    title: '取引信用と連鎖倒産',
    body: (
      <>
        代金を現金で払いきれないと、不足分は
        <span className="font-bold">買掛金</span>
        （後払い）になります。ここが勝負の肝。
        <ul className="mt-3 flex flex-col gap-1.5 text-left">
          <li>
            📊 <span className="font-bold">自己資本比率・格付</span>
            （AAA〜D）で会社の健全度が一目で分かります
          </li>
          <li>
            💸 買掛金には毎ターン金利相当のコストがかかり、資金繰りを圧迫します
          </li>
          <li>
            💥 <span className="font-bold text-market-red">連鎖倒産</span>
            ：取引先が倒産すると売掛金が焦げ付き、あなたまで倒れることも
          </li>
          <li>🏆 ライバルが全社倒産すれば、生き残ったあなたの勝ち</li>
        </ul>
      </>
    ),
  },
  {
    icon: '🚀',
    title: '経営投資で差をつける',
    body: (
      <>
        現金をためるだけでなく、会社そのものへ投資できます（地域金融機関の
        経営支援SaaSが束ねる、補助金・マッチング・DX支援のイメージ）。
        <ul className="mt-3 flex flex-col gap-1.5 text-left">
          <li>
            💻 <span className="font-bold">DX化</span>
            ：投資すると全拠点の売上が永続UP（Lv3まで）
          </li>
          <li>
            🔗 <span className="font-bold">経営支援SaaS</span>
            （月額）：取引額+20%／買掛金利息を軽減／補助金UP
          </li>
          <li>
            🎁 <span className="font-bold text-finance-gold">補助金</span>
            ：DX投資・過疎地域への出店で投資額の一部が戻る
          </li>
        </ul>
        <p className="mt-2 text-[12px] text-smoke-gray">
          ※ 先行投資とSaaS固定費は資金繰りを圧迫します。攻めすぎ注意。
        </p>
      </>
    ),
  },
  {
    icon: '🎨',
    title: 'マスの色＝売上効果',
    body: (
      <>
        駅の色は都市タイプを表し、拠点の
        <span className="font-bold">毎ターン売上</span>に影響します。
        <ul className="mt-3 flex flex-col gap-1.5 text-left">
          {LEGEND_ORDER.map((type) => {
            const info = CITY_TYPE_INFO[type];
            const pct = Math.round((info.revenueMult - 1) * 100);
            const tag = pct === 0 ? '±0%' : `${pct > 0 ? '+' : ''}${pct}%`;
            const color = pct > 0 ? '#5fd97a' : pct < 0 ? '#ff5d7a' : '#9aa0c8';
            return (
              <li key={type} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: CITY_TYPE_CSS[type],
                    boxShadow: `0 0 6px ${CITY_TYPE_CSS[type]}99`,
                  }}
                />
                <span className="font-bold">{CITY_TYPE_LABEL[type]}</span>
                <span className="font-data" style={{ color }}>
                  売上 {tag}
                </span>
                {info.buildMult < 1 && (
                  <span className="font-data text-candy-teal">出店費安</span>
                )}
              </li>
            );
          })}
        </ul>
      </>
    ),
  },
  {
    icon: '🃏',
    title: 'イベントと景気',
    body: (
      <>
        移動先ではハプニングやチャンスが待っています。
        <ul className="mt-3 flex flex-col gap-1.5 text-left">
          <li>🃏 到着時に確率でイベントカードを引きます</li>
          <li>📈 景気（不況↔好況）は毎ラウンド変動し、売上に影響</li>
          <li>💾 進行は自動セーブ。「つづきから」で再開できます</li>
        </ul>
        <p className="mt-3 font-bold text-finance-gold">
          さあ、資産日本一を目指しましょう！
        </p>
      </>
    ),
  },
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const last = PAGES.length - 1;
  const p = PAGES[page];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-midnight-navy/85 backdrop-blur-sm">
      <div className="flex w-[460px] max-w-[92vw] flex-col rounded-pop border-4 border-candy-teal bg-blueberry-700 p-6 shadow-pop-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-candy-teal">📖 遊び方</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-full bg-blueberry-600 px-2.5 py-1 text-smoke-gray transition hover:text-off-white active:translate-y-0.5"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center rounded-pop bg-blueberry-600 px-5 py-6 text-center">
          {page === 0 ? (
            <Mascot size={72} className="animate-bob" />
          ) : (
            <div className="text-5xl">{p.icon}</div>
          )}
          <h3 className="mt-3 font-display text-xl text-off-white">
            {p.title}
          </h3>
          <div className="mt-2 text-sm leading-relaxed text-off-white/90">
            {p.body}
          </div>
        </div>

        {/* ページインジケータ */}
        <div className="mt-4 flex justify-center gap-2">
          {PAGES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}ページ目`}
              onClick={() => setPage(i)}
              className="h-2.5 w-2.5 rounded-full transition"
              style={{
                backgroundColor:
                  i === page ? '#36d6c3' : 'rgba(255,255,255,0.2)',
                transform: i === page ? 'scale(1.2)' : 'none',
              }}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((n) => Math.max(0, n - 1))}
            className={
              page === 0
                ? 'cursor-not-allowed rounded-pop bg-blueberry-600 px-4 py-2 text-sm font-bold text-smoke-gray opacity-40'
                : 'rounded-pop bg-blueberry-600 px-4 py-2 text-sm font-bold text-off-white shadow-pop transition hover:brightness-110 active:translate-y-0.5'
            }
          >
            ◀ 戻る
          </button>
          {page < last ? (
            <button
              type="button"
              onClick={() => setPage((n) => Math.min(last, n + 1))}
              className="flex-1 rounded-pop bg-candy-teal px-4 py-2 text-sm font-bold text-midnight-navy shadow-pop transition hover:brightness-110 active:translate-y-0.5"
            >
              次へ ▶
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-pop bg-finance-gold px-4 py-2 text-sm font-bold text-midnight-navy shadow-pop transition hover:brightness-110 active:translate-y-0.5"
            >
              🎮 はじめる！
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
