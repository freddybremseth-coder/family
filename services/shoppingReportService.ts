// Månedlig handelshistorikk-rapport pr butikk med kategoriser.
import { supabaseFamilyData, isSupabaseConfigured } from '../supabase';

const formatEUR = (v: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);

interface ReportItemRow {
  vendor: string;
  name: string;
  quantity: number;
  totalPrice: number;
  category?: string;
  date: string;
}

export async function generateShoppingReport(userId: string, monthKey?: string): Promise<string> {
  if (!userId || !isSupabaseConfigured()) return '';
  const now = new Date();
  const month = monthKey || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const from = `${month}-01`;
  const nextMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1);
  const to = nextMonth.toISOString().slice(0, 10);

  const { data } = await supabaseFamilyData
    .from('receipt_items')
    .select('vendor, name, quantity, total_price, category, date')
    .eq('user_id', userId)
    .gte('date', from)
    .lt('date', to)
    .order('date', { ascending: true });

  const rows: ReportItemRow[] = (data || []).map((r: any) => ({
    vendor: r.vendor, name: r.name, quantity: Number(r.quantity || 1),
    totalPrice: Number(r.total_price), category: r.category, date: r.date,
  }));

  if (rows.length === 0) {
    return `<!doctype html><html><body style="font-family:sans-serif;padding:32px"><h1>Ingen data for ${month}</h1><p>Ingen kvitteringer med varelinjer for perioden.</p></body></html>`;
  }

  const totalSpent = rows.reduce((s, r) => s + r.totalPrice, 0);

  // Grupper pr vendor
  const byVendor: Record<string, ReportItemRow[]> = {};
  for (const r of rows) {
    if (!byVendor[r.vendor]) byVendor[r.vendor] = [];
    byVendor[r.vendor].push(r);
  }

  // Grupper pr kategori
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    const c = r.category || 'Ukategorisert';
    byCategory[c] = (byCategory[c] || 0) + r.totalPrice;
  }
  const catRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  // Topp 20 varer pr antall kjøp
  const itemCounts: Record<string, { count: number; total: number; sample: string }> = {};
  for (const r of rows) {
    const key = r.name.toLowerCase();
    if (!itemCounts[key]) itemCounts[key] = { count: 0, total: 0, sample: r.name };
    itemCounts[key].count += 1;
    itemCounts[key].total += r.totalPrice;
  }
  const topItems = Object.entries(itemCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 20);

  const vendorSection = Object.entries(byVendor).sort((a, b) => b[1].reduce((s, r) => s + r.totalPrice, 0) - a[1].reduce((s, r) => s + r.totalPrice, 0)).map(([vendor, items]) => {
    const vendorTotal = items.reduce((s, r) => s + r.totalPrice, 0);
    const rowsHtml = items.map(r => `<tr><td>${r.date}</td><td>${r.name}</td><td class="num">${r.quantity}</td><td class="num">${formatEUR(r.totalPrice)}</td><td>${r.category || '—'}</td></tr>`).join('');
    return `<h3>${vendor} — ${formatEUR(vendorTotal)}</h3><table><thead><tr><th>Dato</th><th>Vare</th><th class="num">Ant</th><th class="num">Beløp</th><th>Kategori</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
  }).join('');

  return `<!doctype html><html lang="no"><head><meta charset="utf-8"><title>Handelsrapport ${month}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 32px; color: #0f172a; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 20px 0 8px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
  h3 { font-size: 13px; margin: 14px 0 6px; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
  th, td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  th { background: #f1f5f9; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .kv { display: grid; grid-template-columns: 200px 1fr; gap: 4px 16px; font-size: 13px; margin: 8px 0 12px; }
  .kv dt { color: #64748b; }
  .kv dd { margin: 0; font-weight: 600; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0 20px; }
  .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
  .summary-card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; }
  .summary-card .val { font-size: 18px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; }
</style></head><body>
<h1>Handelsrapport — ${month}</h1>
<p style="color:#64748b;font-size:12px;">Utskrift: ${now.toLocaleString('nb-NO')}</p>

<h2>Sammendrag</h2>
<div class="summary-grid">
  <div class="summary-card"><div class="lbl">Totalt brukt</div><div class="val">${formatEUR(totalSpent)}</div></div>
  <div class="summary-card"><div class="lbl">Antall kjøp</div><div class="val">${rows.length}</div></div>
  <div class="summary-card"><div class="lbl">Butikker</div><div class="val">${Object.keys(byVendor).length}</div></div>
  <div class="summary-card"><div class="lbl">Kategorier</div><div class="val">${Object.keys(byCategory).length}</div></div>
</div>

<h2>Etter kategori</h2>
<table>
  <thead><tr><th>Kategori</th><th class="num">Sum</th><th class="num">% av total</th></tr></thead>
  <tbody>${catRows.map(([cat, total]) => `<tr><td>${cat}</td><td class="num">${formatEUR(total)}</td><td class="num">${Math.round((total / totalSpent) * 100)} %</td></tr>`).join('')}</tbody>
</table>

<h2>Topp 20 varer (antall kjøp)</h2>
<table>
  <thead><tr><th>Vare</th><th class="num">Antall</th><th class="num">Total</th></tr></thead>
  <tbody>${topItems.map(([, info]) => `<tr><td>${info.sample}</td><td class="num">${info.count}</td><td class="num">${formatEUR(info.total)}</td></tr>`).join('')}</tbody>
</table>

<h2>Detaljert pr butikk</h2>
${vendorSection}
</body></html>`;
}

export function printShoppingReport(html: string): void {
  const win = window.open('', '_blank', 'width=1000,height=1300');
  if (!win) { alert('Popup blokkert — tillat popups.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
