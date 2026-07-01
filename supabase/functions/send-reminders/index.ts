// Daglig cron-jobb som sender e-post-påminnelser om forfalne regninger,
// dokumenter som utløper og Mondeo-min ubetalt for inneværende måned.
//
// Setup:
//   supabase functions deploy send-reminders --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=<key> REMINDER_FROM_EMAIL=... REMINDER_APP_URL=https://family.chatgenius.pro
//
// Cron (i Supabase Dashboard → Database → Cron eller pg_cron):
//   select cron.schedule('daily-reminders', '0 8 * * *',
//     $$ select net.http_post(
//         url := '<project>/functions/v1/send-reminders',
//         headers := jsonb_build_object('Authorization', 'Bearer <anon_key>')
//     ) $$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = Deno.env.get('REMINDER_FROM_EMAIL') || 'FamilieHub <no-reply@familyhub.local>';
const APP_URL = Deno.env.get('REMINDER_APP_URL') || 'https://family.chatgenius.pro';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const formatNOK = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(v);
const daysBetween = (a: Date, b: Date) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / (1000 * 60 * 60 * 24));

function nextBillDue(dueDay: number, today: Date): Date {
  const day = Math.min(Math.max(1, dueDay || 1), 28);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), day);
  return thisMonth >= today ? thisMonth : new Date(today.getFullYear(), today.getMonth() + 1, day);
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) { console.log('RESEND_API_KEY mangler — skipping', { to, subject }); return false; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) { console.warn('resend fail', await res.text()); return false; }
    return true;
  } catch (e) { console.warn('resend error', e); return false; }
}

interface Reminder { title: string; subtitle: string; urgency: 'overdue' | 'urgent' | 'later'; amount?: number; }

async function collectReminders(userId: string): Promise<Reminder[]> {
  const today = new Date();
  const items: Reminder[] = [];

  // 1. Bills
  const { data: bills } = await supa.from('bills').select('*').eq('user_id', userId).eq('is_paid', false);
  for (const b of bills || []) {
    const due = nextBillDue(Number(b.due_day || 1), today);
    const days = daysBetween(today, due);
    if (days <= 14) {
      const urgency = days < 0 ? 'overdue' : days <= 7 ? 'urgent' : 'later';
      items.push({
        title: b.name || 'Regning',
        subtitle: `${b.category || 'Regning'} · ${days < 0 ? `${Math.abs(days)} d forsinket` : days === 0 ? 'I dag' : `Om ${days} dager`}`,
        urgency, amount: Number(b.amount || 0),
      });
    }
  }

  // 2. Dokumenter som utløper innen 60 dager
  const { data: docs } = await supa.from('family_documents').select('title, category, owner_label, expiry_date, user_id')
    .eq('user_id', userId).not('expiry_date', 'is', null);
  for (const d of docs || []) {
    const exp = new Date(d.expiry_date);
    if (Number.isNaN(exp.getTime())) continue;
    const days = daysBetween(today, exp);
    if (days <= 60 && days >= -30) {
      const urgency = days < 0 ? 'overdue' : days <= 7 ? 'urgent' : 'later';
      items.push({
        title: `${d.title} utløper`,
        subtitle: `${d.category} · ${d.owner_label || 'Familien'} · ${days < 0 ? `utløpt ${Math.abs(days)} d siden` : `om ${days} dager`}`,
        urgency,
      });
    }
  }

  // 3. Mondeo min-betaling for inneværende måned
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = `${monthKey}-01`;
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10);
  const { data: settings } = await supa.from('mondeo_loan_settings').select('min_monthly_payment').eq('user_id', userId).maybeSingle();
  const { data: payments } = await supa.from('mondeo_loan_payments').select('amount').eq('user_id', userId).gte('date', monthStart).lt('date', nextMonth);
  if (settings) {
    const min = Number(settings.min_monthly_payment || 33000);
    const paid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    if (paid < min) {
      items.push({
        title: 'Mondeo: minimum ubetalt',
        subtitle: `${monthKey} — hovedstolen vokser hvis ikke betalt`,
        urgency: today.getDate() > 25 ? 'urgent' : 'later',
        amount: min - paid,
      });
    }
  }

  return items;
}

function renderHtml(name: string, reminders: Reminder[]): string {
  const overdue = reminders.filter(r => r.urgency === 'overdue');
  const urgent = reminders.filter(r => r.urgency === 'urgent');
  const later = reminders.filter(r => r.urgency === 'later');
  const chunk = (list: Reminder[], toneColor: string) => list.map(r => `
    <tr>
      <td style="padding:12px;border-left:4px solid ${toneColor};background:#fff;">
        <div style="font-weight:700;color:#0f172a">${r.title}</div>
        <div style="font-size:13px;color:#475569;margin-top:2px">${r.subtitle}</div>
        ${r.amount ? `<div style="font-size:13px;color:#0f172a;font-weight:600;margin-top:4px">${formatNOK(r.amount)}</div>` : ''}
      </td>
    </tr>
    <tr><td style="height:8px"></td></tr>
  `).join('');

  return `
<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a">
<div style="max-width:600px;margin:24px auto;padding:24px;background:#fff;border-radius:16px;border:1px solid #e2e8f0">
  <h1 style="font-size:22px;margin:0 0 8px">Hei ${name.split(' ')[0]},</h1>
  <p style="color:#475569;margin:0 0 20px">Her er dagens påminnelser fra FamilieHub:</p>
  ${overdue.length > 0 ? `<h2 style="font-size:14px;color:#b91c1c;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.05em">⚠ Forfalt (${overdue.length})</h2><table style="width:100%;border-collapse:collapse;background:#fef2f2;border-radius:8px">${chunk(overdue, '#b91c1c')}</table>` : ''}
  ${urgent.length > 0 ? `<h2 style="font-size:14px;color:#b45309;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.05em">⏰ Denne uken (${urgent.length})</h2><table style="width:100%;border-collapse:collapse;background:#fffbeb;border-radius:8px">${chunk(urgent, '#d97706')}</table>` : ''}
  ${later.length > 0 ? `<h2 style="font-size:14px;color:#334155;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.05em">🕐 Senere (${later.length})</h2><table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px">${chunk(later, '#64748b')}</table>` : ''}
  <div style="margin-top:24px;text-align:center">
    <a href="${APP_URL}/app.html" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;text-decoration:none;border-radius:12px;font-weight:700">Åpne FamilieHub →</a>
  </div>
  <p style="color:#94a3b8;font-size:12px;margin-top:24px;text-align:center">FamilieHub sender denne e-posten fordi du har aktive påminnelser. Skru av i Innstillinger.</p>
</div>
</body></html>`;
}

Deno.serve(async (_req) => {
  try {
    // Hent alle brukere med profil (senere: filtrer på notification_pref)
    const { data: users, error } = await supa.from('user_profiles').select('id, email');
    if (error) { console.warn('users fetch error', error); return new Response('users error', { status: 500 }); }

    let sent = 0;
    let skipped = 0;
    for (const u of users || []) {
      if (!u.email) { skipped += 1; continue; }
      const reminders = await collectReminders(u.id);
      if (reminders.length === 0) { skipped += 1; continue; }
      const name = String(u.email).split('@')[0];
      const html = renderHtml(name, reminders);
      const subject = reminders.some(r => r.urgency === 'overdue')
        ? `⚠ ${reminders.filter(r => r.urgency === 'overdue').length} forfalt(e) — FamilieHub`
        : `Påminnelser fra FamilieHub (${reminders.length})`;
      const ok = await sendEmail(u.email, subject, html);
      if (ok) sent += 1;
    }

    return new Response(JSON.stringify({ sent, skipped, total: (users || []).length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(`error: ${e}`, { status: 500 });
  }
});
