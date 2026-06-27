import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { useGameStore } from './store/gameStore';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

// 開発時のみ：デバッグ／自動テスト用にストアを公開する
if (import.meta.env.DEV) {
  (window as unknown as { __gameStore?: typeof useGameStore }).__gameStore =
    useGameStore;
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
