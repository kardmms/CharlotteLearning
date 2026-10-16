# Admin Expenses

`/admin/expenses` requires an admin session. The persistent ledger uses integer USD cents and UTC calendar months. It shows recorded receipts less refunds/disputes, recorded operating expenses, net earnings, a 12-month chart, provider breakdowns, and a filtered CSV ledger. Missing bills/connections are excluded; this is not a bank reconciliation. No sample financial data is installed in production.

## Billing sources

- **OpenAI:** `OPENAI_ADMIN_KEY` and `CHARLOTTE_OPENAI_PROJECT_ID` (fallback `OPENAI_USAGE_PROJECT_ID` or `OPENAI_PROJECT_ID`). Without an ID, a single active project with the exact normalized name Charlotte, Charlotte AI, Charlotte Learning, or Charlotte Learning AI may be discovered. Ambiguous matches are not imported. Uses paginated project-scoped Costs API data.
- **Vercel:** existing `VERCEL_API_TOKEN` (fallback `VERCEL_TOKEN` or `VERCEL_ACCESS_TOKEN`), `CHARLOTTE_VERCEL_TEAM_ID`, and `CHARLOTTE_VERCEL_PROJECT_ID` (standard Vercel ID variables also supported). Imports FOCUS BilledCost for Charlotte plus shared team charges, excluding other projects. Shared team costs are attributed in full. Reporting can lag and differ from final invoices.
- **ElevenLabs:** optional `ELEVENLABS_BILLING_API_KEY`, falling back to the existing speech key. Requires subscription read access. Automatically shows the current plan, billing-cycle credit usage, accrued overage costs, and the next invoice amount when reported; usage and upcoming invoices are not assumed to be paid expenses. Enter paid invoices manually. The Charlotte key has User endpoint access enabled for subscription reporting; no billing write access or other generation endpoints are enabled.
- **Stripe:** `STRIPE_SECRET_KEY`, live mode only. Imports USD account payments, refunds/disputes, and fees. Payout principal and transfers are excluded. Use a dedicated Charlotte account; reporting is account-wide. This feature does not create an account, checkout, webhook, or payment.
- **Manual:** actual invoices/payments for ElevenLabs, domains, database, email, and any other services. Negative expenses are credits; negative revenue is a refund. Voiding retains the original record and an admin audit event.

Automatic imports cover the last 12 calendar months, refreshed on page visits at most hourly. Sync billing forces a refresh, subject to a rate limit. This is not a scheduled task. Failed imports retain previous records and show a warning. Repeated imports replace monthly aggregates rather than adding duplicate charges. Non-USD data requires conversion and is not silently combined.

Manual records overlapping an imported provider/month/type are blocked. Manual records already in an import window pause that provider import until they are voided, preventing an invoice being counted twice. Costs entered under Other are not automatically matched to provider invoices.

CSV exports reflect the selected month/provider/search. Text fields guard against spreadsheet formula injection. Older manual months remain selectable; the chart shows the last 12 months. Server actions enforce admin access; provider credentials remain server-only.

References: [OpenAI costs](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs), [Vercel charges](https://vercel.com/docs/rest-api/billing/list-focus-billing-charges), [ElevenLabs subscription](https://elevenlabs.io/docs/api-reference/user/subscription/get), [Stripe transactions](https://docs.stripe.com/api/balance_transactions/list).
