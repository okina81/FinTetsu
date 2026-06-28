import { useEffect } from 'react';
import { useGameStore, type GameStore } from '@/store/gameStore';
import { sfx, unlockAudio } from '@/audio/sfx';
import { startBgm, stopBgm } from '@/audio/bgm';

/**
 * ゲーム状態の遷移を購読して効果音を鳴らし、初回操作で BGM を開始する。
 * ブラウザの自動再生制限に従い、AudioContext は最初のユーザー操作で起動する。
 */
export function useAudio(): void {
  useEffect(() => {
    // --- 状態遷移 → 効果音 ---
    let prev = useGameStore.getState();
    const levelSig = (s: GameStore) => {
      let v = 0;
      for (const k in s.branches) v += s.branches[k].level;
      for (const k in s.develop) v += s.develop[k];
      return v;
    };

    const unsub = useGameStore.subscribe((next) => {
      if (prev.dice == null && next.dice != null) sfx.dice();

      if (prev.phase !== next.phase) {
        if (next.phase === 'event' && next.activeCard) {
          sfx.event(next.activeCard.category);
        } else if (prev.phase === 'moving' && next.phase === 'action') {
          if (next.message.includes('利用料')) sfx.fee();
          else sfx.arrive();
        } else if (next.phase === 'gameover') {
          sfx.win();
        }
      }

      // 支店の設立／強化／育成（レベル和の増加）
      if (levelSig(next) > levelSig(prev)) sfx.build();

      prev = next;
    });

    // --- 初回操作で AudioContext 起動 + BGM 開始 ---
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      unlockAudio();
      startBgm();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    // --- ボタンクリックに UI 音 ---
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('button')) sfx.click();
    };
    window.addEventListener('click', onClick);

    return () => {
      unsub();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', onClick);
      stopBgm();
    };
  }, []);
}
