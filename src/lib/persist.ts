/**
 * localStorage の薄いラッパー。
 * ブラウザでは localStorage、それ以外（テストの Node 環境など）では
 * メモリ Map にフォールバックする。JSON の読み書きも面倒を見る。
 */

const mem = new Map<string, string>();

function backend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof localStorage !== 'undefined') return localStorage;
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
  };
}

export const storage = {
  get(key: string): string | null {
    try {
      return backend().getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      backend().setItem(key, value);
    } catch {
      /* quota / private mode は黙って無視 */
    }
  },
  remove(key: string): void {
    try {
      backend().removeItem(key);
    } catch {
      /* noop */
    }
  },
  getJSON<T>(key: string): T | null {
    const raw = this.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  },
};
