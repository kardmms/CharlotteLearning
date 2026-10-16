export const financeCategories = ['OpenAI', 'ElevenLabs', 'Vercel', 'Stripe', 'Database', 'Email', 'Domains', 'Other'] as const;
export type FinanceRow = { id: string; source: string; category: string; kind: string; amountCents: number; description: string; occurredAt: string };
export type FinanceProvider = { name: string; status: 'connected' | 'unconnected' | 'attention'; detail: string; syncedAt?: string };
export type FinanceSnapshot = { rows: FinanceRow[]; providers: FinanceProvider[]; generatedAt: string };
export function financeMonths(now = new Date()) {
  return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1)).toISOString().slice(0, 7));
}
export function summarizeFinance(rows: FinanceRow[], months: string[]) {
  return months.map(month => {
    const selected = rows.filter(row => row.occurredAt.slice(0, 7) === month);
    const revenue = selected.filter(row => row.kind === 'revenue').reduce((sum, row) => sum + row.amountCents, 0);
    const expenses = selected.filter(row => row.kind === 'expense').reduce((sum, row) => sum + row.amountCents, 0);
    return { month, revenue, expenses, net: revenue - expenses, entries: selected.length };
  });
}
export function parseFinanceAmount(value: string) {
  if (!/^-?\d{1,7}(\.\d{1,2})?$/.test(value)) throw new Error('Enter a USD amount with at most two decimal places.');
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents === 0) throw new Error('Enter a nonzero amount.');
  return cents;
}

export function stripeFinanceAmounts(row: { reporting_category: string; amount: number; fee: number }) {
  const revenueCategories = ['charge', 'refund', 'dispute', 'dispute_reversal', 'refund_failure', 'payment_failure_refund', 'partial_capture_reversal'];
  const revenue = revenueCategories.includes(row.reporting_category) ? row.amount : 0;
  const expenses = row.fee + (['fee', 'fee_credit'].includes(row.reporting_category) ? -row.amount : 0);
  return { revenue, expenses };
}
