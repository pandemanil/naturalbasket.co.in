import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * The cart stores ONLY product ids and quantities in localStorage (temporary, per-browser).
 * Prices and names always come from the live catalogue, and are re-verified by the server at checkout.
 */
export interface CartLine { productId: number; qty: number }

interface CartContextValue {
  lines: CartLine[];
  count: number;
  add: (productId: number, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const KEY = 'nb_cart_v2';
const MAX_QTY = 50;
const CartContext = createContext<CartContextValue | null>(null);

function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l) => Number.isSafeInteger(l?.productId) && Number.isSafeInteger(l?.qty) && l.qty > 0)
      .map((l) => ({ productId: l.productId, qty: Math.min(l.qty, MAX_QTY) }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* storage full or blocked */ }
  }, [lines]);

  const add = useCallback((productId: number, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) return prev.map((l) => (l.productId === productId ? { ...l, qty: Math.min(l.qty + qty, MAX_QTY) } : l));
      return [...prev, { productId, qty: Math.min(qty, MAX_QTY) }];
    });
  }, []);

  const setQty = useCallback((productId: number, qty: number) => {
    setLines((prev) => (qty <= 0
      ? prev.filter((l) => l.productId !== productId)
      : prev.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, MAX_QTY) } : l))));
  }, []);

  const remove = useCallback((productId: number) => setLines((prev) => prev.filter((l) => l.productId !== productId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    add, setQty, remove, clear,
  }), [lines, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
