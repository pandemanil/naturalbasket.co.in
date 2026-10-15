/** Money is stored as integer paise on the server. Convert only for display. */
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(paise / 100);
}

/** Convert a rupee string from a form ("650.50") to integer paise. Returns NaN when invalid. */
export function rupeesToPaise(input: string): number {
  const t = input.trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(Number(t) * 100);
}

export function paiseToRupeesInput(paise: number): string {
  return (paise / 100).toFixed(2).replace(/\.00$/, '');
}
