import 'server-only';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { restrictedFetch } from '@/lib/outbound';
import { financeMonths, stripeFinanceAmounts, type FinanceProvider, type FinanceSnapshot } from '@/lib/finance';

type Total = { month: string; kind: 'revenue' | 'expense'; dollars: number };
const startDate = () => new Date(`${financeMonths()[0]}-01T00:00:00Z`);
async function request(url: URL, headers: Record<string, string>) {
  const result = await restrictedFetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!result.ok) throw new Error(`Provider returned ${result.status}. Check billing access.`);
  return result;
}
async function saveTotals(source: string, category: string, totals: Total[]) {
  // Replace each monthly aggregate, including zero months, so credits and reruns reconcile.
  const months = financeMonths();
  const kinds = source === 'stripe' ? ['revenue', 'expense'] : ['expense'];
  await prisma.$transaction(async tx => {
    const overlap = await tx.financeEntry.findFirst({ where: { source: 'manual', category, kind: { in: kinds }, occurredAt: { gte: startDate() }, voidedAt: null } });
    if (overlap) throw new Error('MANUAL_OVERLAP');
    await Promise.all(months.flatMap(month => kinds.map(kind => {
    const amountCents = Math.round(totals.filter(t => t.month === month && t.kind === kind).reduce((sum, t) => sum + t.dollars, 0) * 100);
    if (!Number.isSafeInteger(amountCents) || Math.abs(amountCents) > 2147483647) throw new Error('Billing amount is outside supported range.');
    const externalKey = `${source}:${month}:${kind}`;
    const data = { source, category, kind, amountCents, description: `${category} ${kind === 'revenue' ? 'payments less refunds / disputes' : 'reported charges'} · ${month}`, occurredAt: new Date(`${month}-01T00:00:00Z`) };
    return tx.financeEntry.upsert({ where: { externalKey }, create: { externalKey, ...data }, update: data });
  })));
  }, { isolationLevel: 'Serializable' });
}
async function openai(): Promise<string> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) return 'Not connected. Add an OpenAI admin billing key, or record invoices below.';
  let project = process.env.CHARLOTTE_OPENAI_PROJECT_ID || process.env.OPENAI_USAGE_PROJECT_ID || process.env.OPENAI_PROJECT_ID;
  if (!project) {
    const url = new URL('https://api.openai.com/v1/organization/projects?limit=100');
    const projects = await (await request(url, { Authorization: `Bearer ${key}` })).json();
    if (!projects.has_more && Array.isArray(projects.data)) {
      const matches = projects.data.filter((p: { name?: string; status?: string }) => p.status !== 'archived' && ['charlotte', 'charlotteai', 'charlottelearning', 'charlottelearningai'].includes((p.name || '').toLowerCase().replace(/[^a-z]/g, '')));
      if (matches.length === 1) project = matches[0].id;
    }
  }
  if (!project) return 'Needs a Charlotte OpenAI project ID to avoid importing unrelated organization spending.';
  const totals: Total[] = [];
  let page: string | undefined;
  const end = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 10; i++) {
    const url = new URL('https://api.openai.com/v1/organization/costs');
    url.search = new URLSearchParams({ start_time: String(startDate().getTime() / 1000), end_time: String(end), bucket_width: '1d', limit: '180', project_ids: project, ...(page ? { page } : {}) }).toString();
    const body = await (await request(url, { Authorization: `Bearer ${key}` })).json();
    if (!Array.isArray(body.data)) throw new Error('Invalid OpenAI billing response.');
    for (const bucket of body.data) for (const row of bucket.results ?? []) {
      if (row.amount?.currency?.toLowerCase() !== 'usd') throw new Error('Non-USD OpenAI data needs conversion before import.');
      const dollars = Number(row.amount.value);
      if (!Number.isFinite(dollars)) throw new Error('Invalid OpenAI amount.');
      totals.push({ month: new Date(bucket.start_time * 1000).toISOString().slice(0, 7), kind: 'expense', dollars });
    }
    if (!body.has_more) { await saveTotals('openai', 'OpenAI', totals); return ''; }
    page = body.next_page;
    if (!page) throw new Error('Incomplete OpenAI billing pagination.');
  }
  throw new Error('OpenAI import exceeded page limit; saved history retained.');
}
async function vercel(): Promise<string> {
  const key = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN;
  const team = process.env.CHARLOTTE_VERCEL_TEAM_ID || process.env.VERCEL_TEAM_ID;
  const project = process.env.CHARLOTTE_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID;
  if (!key || !team || !project) return 'Not connected. Add Vercel billing access, team and project IDs, or record invoices below.';
  const url = new URL('https://api.vercel.com/v1/billing/charges');
  url.search = new URLSearchParams({ teamId: team, from: startDate().toISOString(), to: new Date().toISOString() }).toString();
  const response = await request(url, { Authorization: `Bearer ${key}` });
  const text = await response.text();
  if (text.length > 15000000) throw new Error('Vercel billing response is too large.');
  const totals: Total[] = [];
  for (const line of text.split('\n').filter(l => l.trim())) {
    const row = JSON.parse(line);
    // Project-specific usage plus shared team charges. Never import other projects.
    const tags = typeof row.Tags === 'string' ? JSON.parse(row.Tags) : row.Tags;
    if (!tags || typeof tags !== 'object' || Array.isArray(tags)) throw new Error('Unrecognized Vercel billing tags; import stopped.');
    if (tags.ProjectId && tags.ProjectId !== project) continue;
    if (row.BillingCurrency?.toLowerCase() !== 'usd') throw new Error('Non-USD Vercel data needs conversion before import.');
    const dollars = Number(row.BilledCost);
    if (!Number.isFinite(dollars)) throw new Error('Invalid Vercel amount.');
    totals.push({ month: new Date(row.ChargePeriodStart).toISOString().slice(0, 7), kind: 'expense', dollars });
  }
  await saveTotals('vercel', 'Vercel', totals);
  return '';
}
async function stripe(): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return 'Not connected yet. Payments, refunds and processing fees will import once live Stripe is linked.';
  if (!key.startsWith('sk_live_') && !key.startsWith('rk_live_')) return 'Stripe test mode detected. Test payments are excluded from real earnings.';
  const client = new Stripe(key, { timeout: 15000, maxNetworkRetries: 0 });
  const totals: Total[] = [];
  let cursor: string | undefined;
  const end = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 50; i++) {
    const page = await client.balanceTransactions.list({ limit: 100, created: { gte: startDate().getTime() / 1000, lt: end }, ...(cursor ? { starting_after: cursor } : {}) });
    for (const row of page.data) {
      if (row.currency !== 'usd') throw new Error('Non-USD Stripe data needs conversion before import.');
      const month = new Date(row.created * 1000).toISOString().slice(0, 7);
      const amounts = stripeFinanceAmounts(row);
      if (amounts.revenue) totals.push({ month, kind: 'revenue', dollars: amounts.revenue / 100 });
      if (amounts.expenses) totals.push({ month, kind: 'expense', dollars: amounts.expenses / 100 });
    }
    if (!page.has_more) { await saveTotals('stripe', 'Stripe', totals); return ''; }
    cursor = page.data.at(-1)?.id;
    if (!cursor) throw new Error('Incomplete Stripe pagination.');
  }
  throw new Error('Stripe import exceeded 5,000 records; saved history retained.');
}
async function elevenlabs(): Promise<string> {
  const key = process.env.ELEVENLABS_BILLING_API_KEY || process.env.ELEVENLABS_API_KEY;
  if (!key) return 'Voice billing is not connected. Record ElevenLabs invoices below.';
  const body = await (await request(new URL('https://api.elevenlabs.io/v1/user/subscription'), { 'xi-api-key': key })).json();
  const used = Number(body.character_count);
  const limit = Number(body.character_limit);
  if (!Number.isFinite(used) || !Number.isFinite(limit)) throw new Error('Invalid ElevenLabs usage response.');
  return `${used.toLocaleString('en-US')} / ${limit.toLocaleString('en-US')} characters this billing cycle. Record paid invoices below; character usage is not a dollar charge.`;
}
const sources = [
  { name: 'OpenAI', key: 'openai', run: openai },
  { name: 'ElevenLabs', key: 'elevenlabs', run: elevenlabs },
  { name: 'Vercel', key: 'vercel', run: vercel },
  { name: 'Stripe', key: 'stripe', run: stripe }
];
export async function getFinanceSnapshot(force = false): Promise<FinanceSnapshot> {
  const providers = await Promise.all(sources.map(async source => {
    const key = `finance-sync:${source.key}`;
    const cached = await prisma.adminSetting.findUnique({ where: { key } });
    if (!force && cached?.value && Date.now() - cached.updatedAt.getTime() < 3600000) return JSON.parse(cached.value) as FinanceProvider;
    let provider: FinanceProvider;
    try {
      const detail = await source.run();
      const connected = !detail || detail.includes('characters this billing cycle');
      provider = { name: source.name, status: connected ? 'connected' : 'unconnected', detail: detail || (source.key === 'vercel' ? 'Charlotte project usage plus shared team charges. Reported charges may lag; invoices may differ.' : source.key === 'stripe' ? 'Live account payments, refunds, disputes and fees. Payouts and transfers are excluded.' : 'Reported usage costs for the Charlotte OpenAI project. Provider reporting may lag.'), syncedAt: connected ? new Date().toISOString() : undefined };
    } catch (error) {
      provider = { name: source.name, status: 'attention', detail: error instanceof Error && error.message === 'MANUAL_OVERLAP' ? 'Manual records overlap this provider’s import window. Void those manual records before syncing to prevent double counting.' : source.key === 'elevenlabs' ? 'Voice is connected, but billing access is unavailable. Add a billing-readable ElevenLabs key or record invoices below.' : 'Billing import unavailable. Check provider credentials and permissions. Previously imported records are retained.' };
    }
    await prisma.adminSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(provider) }, update: { value: JSON.stringify(provider) } });
    return provider;
  }));
  const entries = await prisma.financeEntry.findMany({ where: { voidedAt: null }, orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }] });
  return { rows: entries.map(e => ({ id: e.id, source: e.source, category: e.category, kind: e.kind, amountCents: e.amountCents, description: e.description, occurredAt: e.occurredAt.toISOString() })), providers, generatedAt: new Date().toISOString() };
}
