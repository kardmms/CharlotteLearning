'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { financeCategories, parseFinanceAmount } from '@/lib/finance';
import { getFinanceSnapshot } from '@/lib/finance-providers';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function addFinanceEntry(_state: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  const admin = await requireAdmin();
  await enforceRateLimit({ scope: 'finance-write', identifier: admin.id, limit: 60, windowSeconds: 3600 });
  try {
    const category = String(form.get('category'));
    const kind = String(form.get('kind'));
    const description = String(form.get('description') || '').trim();
    const date = String(form.get('date'));
    const token = String(form.get('token'));
    const amountCents = parseFinanceAmount(String(form.get('amount')));
    if (!financeCategories.includes(category as typeof financeCategories[number]) || !['expense', 'revenue'].includes(kind)) throw new Error('Choose a valid category and type.');
    if (!description || description.length > 240) throw new Error('Enter a description of 1–240 characters.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error('Choose a valid date.');
    if (!/^[0-9a-f-]{36}$/.test(token)) throw new Error('Reload the page and try again.');
    const occurredAt = new Date(`${date}T00:00:00Z`);
    if (occurredAt > new Date() || occurredAt.getUTCFullYear() < 2020) throw new Error('Use a date between 2020 and today for recorded transactions.');
    const nextMonth = new Date(Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth()+1,1));
    const monthStart = new Date(Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(),1));
    // Serializable with provider imports so a manual invoice cannot race an automatic aggregate.
    await prisma.$transaction(async tx => {
      const overlap = await tx.financeEntry.findFirst({ where: { category, kind, source: { not: 'manual' }, occurredAt: { gte: monthStart, lt: nextMonth }, voidedAt: null } });
      if (overlap) throw new Error('This provider already has imported totals for that month. Add only unrelated costs under Other to avoid counting an invoice twice.');
      const entry = await tx.financeEntry.upsert({ where: { externalKey: `manual:${token}` }, create: { externalKey: `manual:${token}`, source: 'manual', category, kind, description, amountCents, occurredAt }, update: {} });
      await tx.auditEvent.create({ data: { actorType: 'admin', actorId: admin.id, action: 'finance.entry.recorded', targetType: 'FinanceEntry', targetId: entry.id } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/expenses');
    return { success: 'Transaction recorded.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const expected = ['Enter a USD', 'Enter a nonzero', 'Choose a valid', 'Enter a description', 'Reload the page', 'Use a date', 'This provider already'];
    return { error: expected.some(prefix => message.startsWith(prefix)) ? message : 'Could not save this transaction. Please try again.' };
  }
}
export async function voidFinanceEntry(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get('id'));
  await prisma.$transaction(async tx => {
    const result = await tx.financeEntry.updateMany({ where: { id, source: 'manual', voidedAt: null }, data: { voidedAt: new Date() } });
    if (result.count) await tx.auditEvent.create({ data: { actorType: 'admin', actorId: admin.id, action: 'finance.entry.voided', targetType: 'FinanceEntry', targetId: id } });
  });
  revalidatePath('/admin/expenses');
}
export async function refreshFinance() {
  const admin = await requireAdmin();
  await enforceRateLimit({ scope: 'finance-sync', identifier: admin.id, limit: 6, windowSeconds: 3600 });
  await getFinanceSnapshot(true);
  revalidatePath('/admin/expenses');
}
