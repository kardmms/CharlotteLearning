import assert from 'node:assert/strict';
import test from 'node:test';
import { financeMonths, parseFinanceAmount, parseElevenBilling, stripeFinanceAmounts, summarizeFinance, type FinanceRow } from '../src/lib/finance.ts';
const row = (kind: string, cents: number, date = '2026-10-15T00:00:00Z'): FinanceRow => ({ id: 'test', source: 'manual', category: 'Other', kind, amountCents: cents, description: 'test', occurredAt: date });
test('finance months cross year boundaries in UTC and include the current month', () => {
  const months = financeMonths(new Date('2026-01-01T00:30:00Z'));
  assert.equal(months.length,12); assert.equal(months[0],'2025-02'); assert.equal(months[11],'2026-01');
});
test('financial totals subtract refunds, include expense credits, and isolate months', () => {
  const rows=[row('revenue',10000),row('revenue',-1000),row('expense',3000),row('expense',-500),row('expense',20000,'2026-09-30T23:59:59Z')];
  assert.deepEqual(summarizeFinance(rows,['2026-10','2026-11']),[
    {month:'2026-10',revenue:9000,expenses:2500,net:6500,entries:4},
    {month:'2026-11',revenue:0,expenses:0,net:0,entries:0}
  ]);
});
test('money input preserves exact cents and rejects invalid precision and ranges', () => {
  assert.equal(parseFinanceAmount('19.99'),1999); assert.equal(parseFinanceAmount('-0.25'),-25); assert.equal(parseFinanceAmount('0.29'),29);
  for(const value of ['NaN','Infinity','0','1.999','1e3','10000000','']) assert.throws(()=>parseFinanceAmount(value));
});

test('Stripe income uses gross less refunds and disputes, with fees counted once', () => {
  assert.deepEqual(stripeFinanceAmounts({reporting_category:'charge',amount:10000,fee:320}),{revenue:10000,expenses:320});
  assert.deepEqual(stripeFinanceAmounts({reporting_category:'refund',amount:-5000,fee:0}),{revenue:-5000,expenses:0});
  assert.deepEqual(stripeFinanceAmounts({reporting_category:'dispute',amount:-10000,fee:1500}),{revenue:-10000,expenses:1500});
  assert.deepEqual(stripeFinanceAmounts({reporting_category:'fee',amount:-300,fee:0}),{revenue:0,expenses:300});
  assert.deepEqual(stripeFinanceAmounts({reporting_category:'fee_credit',amount:100,fee:0}),{revenue:0,expenses:-100});
  assert.deepEqual(stripeFinanceAmounts({reporting_category:'payout',amount:-8000,fee:25}),{revenue:0,expenses:25});
  assert.deepEqual(stripeFinanceAmounts({reporting_category:'transfer',amount:8000,fee:0}),{revenue:0,expenses:0});
});

test('ElevenLabs billing exposes real overage and upcoming invoice without inventing paid charges', () => {
  const input = {tier:'free',character_count:1085,character_limit:10000,currency:'usd',current_overage:{amount:'0',currency:'usd'},next_invoice:null};
  const free = parseElevenBilling(input);
  assert.equal(free.overageCents,0); assert.equal(free.nextInvoiceCents,null); assert.equal(free.plan,'free');
  const paid = parseElevenBilling({...input,tier:'creator',current_overage:{amount:'2.35',currency:'usd'},next_invoice:{amount_due_cents:2435}});
  assert.equal(paid.overageCents,235); assert.equal(paid.nextInvoiceCents,2435);
  assert.throws(()=>parseElevenBilling({...input,current_overage:{amount:'oops',currency:'usd'}}));
  assert.throws(()=>parseElevenBilling({...input,next_invoice:{amount_due_cents:1.5}}));
});
