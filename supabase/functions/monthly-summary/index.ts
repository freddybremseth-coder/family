// Månedlig oppsummering-e-post: kjøres 1. hver måned.
// Aggregerer forrige måneds transaksjoner, receipt_items, sparepotensial
// og sender som HTML-mail via Resend.
//
// Deploy:
//   supabase functions deploy monthly-summary --no-verify-jwt
// Cron:
//   select cron.schedule('monthly-summary', '0 9 1 * *',
//     $$ select net.http_post(url := '<url>/functions/v1/monthly-summary',
//        headers := jsonb_build_object('Authorization', 'Bearer <anon_key>')) $$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = Deno.env.get('REMINDER_FROM_EMAIL') || 'FamilieHub <no-reply@familyhub.local>';
const APP_URL = Deno.env.get('REMINDER_APP_URL') || 'https://family.chatgenius.pro';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const formatEUR = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const formatPct = (v: number) => `${Math.round(v * 100)} %`;

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) { console.log('RESEND_API_KEY mangler', { to }); return false; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  return res.ok;
}

async function buildSummary(userId: string, monthKey: string) {
  const from = `${monthKey}-01`;
  const [year, month] = monthKey.split('-').map(Number);
  const nextMonth = new Date(year, month, 1).toISOString().slice(0, 10);

  const [txResp, itemsResp] = await Promise.all([
    supa.from('transactions').select('*').eq('user_id', userId).gte('date', from).lt('date', nextMonth),
    supa.from('receipt_items').select('vendor, total_price, name, category').eq('user_id', userId).gte('date', from).lt('date', nextMonth),
  ]);

  const tx = txResp.data || [];
  const items = itemsResp.data || [];

  const income = tx.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expense = tx.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const net = income - expense;

  // Top-vendorer
  const vendorTotals: Record<string, number> = {};
  for (const it of items) {
    vendorTotals[it.vendor] = (vendorTotals[it.vendor] || 0) + Number(it.total_price);
  }
  const topVendors = Object.entries(vendorTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Top-kategorier
  const catTotals: Record<string, number> = {};
  for (const t of tx.filter((t: any) => t.type === 'EXPENSE')) {
    const c = t.category || 'Annet';
    catTotals[c] = (catTotals[c] || 0) + Number(t.amount);
  }
  const topCategories = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return { income, expense, net, topVendors, topCategories, txCount: tx.length, itemCount: items.length };
}

function renderHtml(name: string, monthKey: string, summary: any): string {
  const [year, month] = monthKey.split('-').map(Number);
  const monthName = new Date(year, month - 1).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
  const netColor = summary.net >= 0 ? '#047857' : '#b91c1c';
  const netSign = summary.net >= 0 ? '+' : '';

  return `<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a">
<div style="max-width:640px;margin:24px auto;padding:24px;background:#fff;border-radius:16px;border:1px solid #e2e8f0">
  <h1 style="font-size:24px;margin:0 0 4px">Månedlig oppsummering</h1>
  <p style="color:#64748b;margin:0 0 24px;text-transform:capitalize">${monthName}</p>

  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <tr>
      <td style="width:33%;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;text-align:center">
        <div style="font-size:10px;color:#047857;text-transform:uppercase;font-weight:700">Inntekt</div>
        <div style="font-size:20px;font-weight:800;color:#047857;margin-top:4px">${formatEUR(summary.income)}</div>
      </td>
      <td style="width:1%"></td>
      <td style="width:33%;padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;text-align:center">
        <div style="font-size:10px;color:#b91c1c;text-transform:uppercase;font-weight:700">Utgift</div>
        <div style="font-size:20px;font-weight:800;color:#b91c1c;margin-top:4px">${formatEUR(summary.expense)}</div>
      </td>
      <td style="width:1%"></td>
      <td style="width:33%;padding:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;text-align:center">
        <div style="font-size:10px;color:#475569;text-transform:uppercase;font-weight:700">Netto</div>
        <div style="font-size:20px;font-weight:800;color:${netColor};margin-top:4px">${netSign}${formatEUR(summary.net)}</div>
      </td>
    </tr>
  </table>

  <h2 style="font-size:12px;margin:24px 0 8px;color:#475569;text-transform:uppercase;letter-spacing:0.06em">Topp butikker</h2>
  <table style="width:100%;font-size:13px">
    ${summary.topVendors.map(([v, total]: [string, number]) => `<tr><td style="padding:6px 0;color:#334155">${v}</td><td style="text-align:right;font-weight:600">${formatEUR(total)}</td></tr>`).join('')}
  </table>

  <h2 style="font-size:12px;margin:24px 0 8px;color:#475569;text-transform:uppercase;letter-spacing:0.06em">Topp kategorier</h2>
  <table style="width:100%;font-size:13px">
    ${summary.topCategories.map(([c, total]: [string, number]) => `<tr><td style="padding:6px 0;color:#334155">${c}</td><td style="text-align:right;font-weight:600">${formatEUR(total)}</td></tr>`).join('')}
  </table>

  <p style="color:#64748b;font-size:12px;margin:24px 0 8px">${summary.txCount} transaksjoner · ${summary.itemCount} varelinjer fra kvitteringer</p>

  <div style="margin-top:24px;text-align:center">
    <a href="${APP_URL}/app.html" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;text-decoration:none;border-radius:12px;font-weight:700">Åpne full rapport →</a>
  </div>
  <p style="color:#94a3b8;font-size:11px;margin-top:20px;text-align:center">Automatisk generert av FamilieHub den 1. hver måned. Skru av i Innstillinger.</p>
</div>
</body></html>`;
}

Deno.serve(async () => {
  try {
    const now = new Date();
    // Forrige måned
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    const { data: users, error } = await supa.from('user_profiles').select('id, email');
    if (error) return new Response('users error', { status: 500 });

    let sent = 0;
    let skipped = 0;
    for (const u of users || []) {
      if (!u.email) { skipped += 1; continue; }
      const summary = await buildSummary(u.id, monthKey);
      if (summary.txCount === 0 && summary.itemCount === 0) { skipped += 1; continue; }
      const name = String(u.email).split('@')[0];
      const html = renderHtml(name, monthKey, summary);
      const subject = `Månedlig oppsummering — ${new Date(prev).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })}`;
      const ok = await sendEmail(u.email, subject, html);
      if (ok) sent += 1;
    }

    return new Response(JSON.stringify({ sent, skipped, month: monthKey }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(`error: ${e}`, { status: 500 });
  }
});
