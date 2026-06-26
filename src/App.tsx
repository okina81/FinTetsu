import type { ReactNode } from 'react';
import { PhaserContainer } from '@/components/PhaserContainer';

/**
 * 実装設計書 3-1 メインゲーム画面レイアウトの React シェル。
 *
 *   ┌ トップバー ───────────────────────────┐
 *   │ マップ(Phaser)          │ 右パネル(HUD)│
 *   └ アクションバー ──────────────────────┘
 *
 * 現段階（Step 1〜3）では Phaser マップ描画が主役。
 * HUD・支店一覧・カード・アクションは後続ステップで中身を実装する。
 */
export default function App() {
  return (
    <div className="flex h-full w-full flex-col bg-midnight-navy text-off-white">
      {/* トップバー */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-2.5">
        <h1 className="font-display text-xl font-bold text-finance-gold">
          FinTetsu<span className="ml-2 text-sm text-smoke-gray">フィン鉄</span>
        </h1>
        <div className="flex items-center gap-6 text-sm">
          <span className="font-data text-smoke-gray">
            ターン <span className="text-off-white">1</span>/100
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
        {/* マップエリア（Phaser キャンバス） */}
        <main className="relative min-w-0 flex-1">
          <PhaserContainer />
        </main>

        {/* 右パネル（HUD・支店一覧・カード — 後続ステップ） */}
        <aside className="hidden w-72 shrink-0 flex-col gap-3 border-l border-white/10 p-4 lg:flex">
          <PanelStub title="プレイヤーHUD">
            <div className="rounded-lg border border-white/10 bg-map-ground p-3">
              <div className="text-sm">🏦 あなた</div>
              <div className="font-data text-lg text-finance-gold">¥—</div>
              <div className="font-data text-xs text-smoke-gray">借入 ¥—</div>
            </div>
          </PanelStub>
          <PanelStub title="支店一覧">
            <p className="text-xs text-smoke-gray">まだ支店がありません</p>
          </PanelStub>
          <PanelStub title="手持ちカード">
            <p className="text-xs text-smoke-gray">—</p>
          </PanelStub>
        </aside>
      </div>

      {/* アクションバー（後続ステップで有効化） */}
      <footer className="flex items-center gap-3 border-t border-white/10 px-5 py-3">
        <ActionStub label="🎲 サイコロを振る" primary />
        <ActionStub label="💼 支店強化" />
        <ActionStub label="🤝 提携交渉" />
      </footer>
    </div>
  );
}

function PanelStub({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-smoke-gray">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ActionStub({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      disabled
      className={
        primary
          ? 'cursor-not-allowed rounded-lg bg-finance-gold/90 px-4 py-2 text-sm font-bold text-midnight-navy opacity-60'
          : 'cursor-not-allowed rounded-lg border border-white/15 px-4 py-2 text-sm text-off-white opacity-50'
      }
    >
      {label}
    </button>
  );
}
