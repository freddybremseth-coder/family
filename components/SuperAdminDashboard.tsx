import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import { ADMIN_MODULES, AdminUserProfile, fetchAdminUsers, setUserModuleAccess } from '../services/adminService';
import { supabase } from '../supabase';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || 'trial').toLowerCase();
  const className = normalized.includes('paid') || normalized.includes('active') || normalized.includes('lifetime')
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : normalized.includes('trial')
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${className}`}>{status || 'trial'}</span>;
}

export const SuperAdminDashboard = () => {
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const rows = await fetchAdminUsers();
      setUsers(rows);
    } catch (err: any) {
      setError(err?.message || 'Klarte ikke å hente brukere. Kjør admin-migrasjonen og sjekk RLS/admin-policy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => `${user.email} ${user.familyName} ${user.subscriptionStatus}`.toLowerCase().includes(q));
  }, [query, users]);

  const stats = useMemo(() => ({
    total: users.length,
    trial: users.filter((user) => String(user.subscriptionStatus).toLowerCase().includes('trial')).length,
    paid: users.filter((user) => ['paid', 'active', 'lifetime'].some((s) => String(user.subscriptionStatus).toLowerCase().includes(s))).length,
    business: users.filter((user) => user.enabledModules.includes('business')).length,
  }), [users]);

  const toggleModule = async (user: AdminUserProfile, moduleId: string) => {
    const enabled = !user.enabledModules.includes(moduleId);
    const key = `${user.id}:${moduleId}`;
    setSavingKey(key);
    setError(null);
    setMessage(null);
    const previous = users;
    setUsers((prev) => prev.map((row) => row.id === user.id ? {
      ...row,
      enabledModules: enabled
        ? Array.from(new Set([...row.enabledModules, moduleId]))
        : row.enabledModules.filter((id) => id !== moduleId),
    } : row));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await setUserModuleAccess(user.id, moduleId, enabled, sessionData.session?.user?.id);
      setMessage(`${moduleId} ${enabled ? 'aktivert' : 'deaktivert'} for ${user.email}`);
    } catch (err: any) {
      setUsers(previous);
      setError(err?.message || 'Klarte ikke å oppdatere modul.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><ShieldCheck className="h-5 w-5" /></div>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Admin</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">Brukere og moduler</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">Se ekte testbrukere fra FamilyHub Supabase og styr hvilke moduler hver bruker får tilgang til.</p>
        </div>
        <button onClick={loadUsers} className="btn-secondary w-full md:w-auto" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Oppdater</button>
      </section>

      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><div className="flex gap-2"><CheckCircle2 className="h-5 w-5 shrink-0" /><p>{message}</p></div></div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><div className="flex gap-2"><AlertCircle className="h-5 w-5 shrink-0" /><p>{error}</p></div></div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-5"><p className="text-sm text-slate-500">Brukere</p><p className="mt-1 text-3xl font-black text-slate-900">{stats.total}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Prøvebrukere</p><p className="mt-1 text-3xl font-black text-slate-900">{stats.trial}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Betalt/aktiv</p><p className="mt-1 text-3xl font-black text-slate-900">{stats.paid}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Business-tilgang</p><p className="mt-1 text-3xl font-black text-slate-900">{stats.business}</p></Card>
      </section>

      <Card>
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3"><Users className="h-5 w-5 text-slate-500" /><div><h2 className="text-xl font-bold text-slate-900">Brukeroversikt</h2><p className="text-sm text-slate-500">Ingen dummy-brukere. Listen kommer fra `family.user_profiles`.</p></div></div>
            <div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk e-post eller familie" /></div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Laster brukere...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Ingen brukere funnet. Opprett en testbruker, eller kjør admin-migrasjonen i FamilyHub Supabase.</div>
          ) : (
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Bruker</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Opprettet</th>
                  <th className="px-5 py-4">Moduler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-5">
                      <p className="font-bold text-slate-900">{user.familyName}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{user.email || user.id}</p>
                    </td>
                    <td className="px-5 py-5"><StatusBadge status={user.subscriptionStatus} /></td>
                    <td className="px-5 py-5 text-xs text-slate-500">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('nb-NO') : '—'}</td>
                    <td className="px-5 py-5">
                      <div className="flex max-w-3xl flex-wrap gap-2">
                        {ADMIN_MODULES.map((module) => {
                          const enabled = user.enabledModules.includes(module.id);
                          const key = `${user.id}:${module.id}`;
                          return (
                            <button
                              key={module.id}
                              onClick={() => toggleModule(user, module.id)}
                              disabled={savingKey === key}
                              className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${enabled ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'} disabled:opacity-60`}
                              title={module.id === 'business' ? 'Business gir tilgang til dine private RealtyFlow/Olivia-tall. Gi kun til interne brukere.' : undefined}
                            >
                              {savingKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <SlidersHorizontal className="h-3 w-3" />}
                              {module.label}
                            </button>
                          );
                        })}
                      </div>
                      {user.enabledModules.includes('business') && <p className="mt-3 text-xs font-semibold text-amber-700">Denne brukeren har Business-tilgang.</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};
