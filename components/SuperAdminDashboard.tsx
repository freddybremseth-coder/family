import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Crown, Loader2, PackagePlus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Trash2, Users, X } from 'lucide-react';
import { ADMIN_MODULES, AdminUserProfile, deleteAdminUser, fetchAdminUsers, MARKETPLACE_MODULES, PLAN_DEFINITIONS, setUserModuleAccess } from '../services/adminService';
import { supabase } from '../supabase';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || 'trial').toLowerCase();
  const className = normalized.includes('lifetime') || normalized.includes('livstid')
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : normalized.includes('paid') || normalized.includes('active') || normalized.includes('betalt')
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalized.includes('trial')
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${className}`}>{normalized.includes('lifetime') || normalized.includes('livstid') ? <Crown className="h-3 w-3" /> : null}{status || 'trial'}</span>;
}

export const SuperAdminDashboard = () => {
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUserProfile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    return users.filter((user) => `${user.email} ${user.familyName} ${user.familyId || ''} ${user.subscriptionStatus} ${user.plan || ''}`.toLowerCase().includes(q));
  }, [query, users]);

  const stats = useMemo(() => ({
    total: users.length,
    trial: users.filter((user) => String(user.subscriptionStatus).toLowerCase().includes('trial')).length,
    paid: users.filter((user) => ['paid', 'active', 'lifetime', 'livstid', 'betalt'].some((s) => String(user.subscriptionStatus).toLowerCase().includes(s))).length,
    business: users.filter((user) => user.enabledModules.includes('business')).length,
  }), [users]);

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    const user = confirmDelete;
    setDeletingId(user.id);
    setError(null);
    setMessage(null);
    try {
      await deleteAdminUser(user.id, user.email);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setMessage(`Bruker «${user.email || user.id}» slettet. Auth-recorden kan beholdes i Supabase – slett manuelt om nødvendig.`);
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err?.message || 'Klarte ikke å slette brukeren.');
    } finally {
      setDeletingId(null);
    }
  };

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
      {/* Bekreftelses-modal for sletting */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button onClick={() => setConfirmDelete(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700"><Trash2 className="h-5 w-5" /></div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900">Slett bruker?</h3>
                <p className="mt-2 text-sm text-slate-600">Du er i ferd med å slette <span className="font-bold text-slate-900">{confirmDelete.email || confirmDelete.id}</span> ({confirmDelete.familyName}). Dette fjerner bruker-profilen og modul-tilgangene.</p>
                <p className="mt-2 text-xs text-amber-700"><span className="font-bold">Merk:</span> Auth-recorden i Supabase kan bli liggende — slett manuelt fra Authentication-fanen om nødvendig.</p>
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Avbryt</button>
              <button onClick={handleDeleteUser} disabled={deletingId === confirmDelete.id} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-2">
                {deletingId === confirmDelete.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Slett bruker
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><ShieldCheck className="h-5 w-5" /></div>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Admin</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">Brukere, abonnement og moduler</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">Freddy vises som livstidsabonnement. Nye SaaS-brukere skal ha egen familie/household og ingen innsyn i dine eller andre kunders data.</p>
        </div>
        <button onClick={loadUsers} className="btn-secondary w-full md:w-auto" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Oppdater</button>
      </section>

      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><div className="flex gap-2"><CheckCircle2 className="h-5 w-5 shrink-0" /><p>{message}</p></div></div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><div className="flex gap-2"><AlertCircle className="h-5 w-5 shrink-0" /><p>{error}</p></div></div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-5"><p className="text-sm text-slate-500">Brukere</p><p className="mt-1 text-3xl font-black text-slate-900">{stats.total}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Prøvebrukere</p><p className="mt-1 text-3xl font-black text-slate-900">{stats.trial}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Betalt/livstid</p><p className="mt-1 text-3xl font-black text-slate-900">{stats.paid}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Business-tilgang</p><p className="mt-1 text-3xl font-black text-slate-900">{stats.business}</p></Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLAN_DEFINITIONS.map((plan) => (
          <Card key={plan.id} className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">{plan.id === 'lifetime' ? <Crown className="h-5 w-5" /> : <PackagePlus className="h-5 w-5" />}</div>
              <div>
                <h3 className="font-black text-slate-900">{plan.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{plan.description}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{plan.modules.length} moduler inkludert</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3"><PackagePlus className="h-5 w-5 text-slate-500" /><div><h2 className="text-xl font-bold text-slate-900">Modulbutikk / add-ons</h2><p className="text-sm text-slate-500">Bruker-dashboardet kan senere kobles til betaling. Admin kan aktivere moduler manuelt allerede nå.</p></div></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {MARKETPLACE_MODULES.map((module) => <div key={module.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-900">{module.label}</p><p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p></div>)}
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3"><Users className="h-5 w-5 text-slate-500" /><div><h2 className="text-xl font-bold text-slate-900">Brukeroversikt</h2><p className="text-sm text-slate-500">Ingen dummy-brukere. Listen kommer fra `family.user_profiles`, og Freddy vises som livstidsabonnement.</p></div></div>
            <div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk e-post, familie eller plan" /></div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Laster brukere...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Ingen brukere funnet. Opprett en testbruker, eller kjør admin-migrasjonen i FamilyHub Supabase.</div>
          ) : (
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Bruker</th>
                  <th className="px-5 py-4">Familie-ID</th>
                  <th className="px-5 py-4">Plan/status</th>
                  <th className="px-5 py-4">Opprettet</th>
                  <th className="px-5 py-4">Moduler</th>
                  <th className="px-5 py-4 text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-5">
                      <p className="font-bold text-slate-900">{user.familyName}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{user.email || user.id}</p>
                    </td>
                    <td className="px-5 py-5"><p className="font-mono text-xs text-slate-600">{user.familyId || user.id}</p></td>
                    <td className="px-5 py-5"><div className="space-y-2"><StatusBadge status={user.subscriptionStatus} /><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{user.plan || 'basic'}</p></div></td>
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
                              title={module.id === 'business' ? 'Business gir tilgang til private RealtyFlow/Olivia-tall. Ikke aktiver for vanlige SaaS-kunder uten egen integrasjon.' : undefined}
                            >
                              {savingKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <SlidersHorizontal className="h-3 w-3" />}
                              {module.label}
                            </button>
                          );
                        })}
                      </div>
                      {user.enabledModules.includes('business') && <p className="mt-3 text-xs font-semibold text-amber-700">Denne brukeren har Business-tilgang. For SaaS skal dette kobles til brukerens egne API-nøkler/databaser.</p>}
                    </td>
                    <td className="px-5 py-5 text-right">
                      {String(user.email).toLowerCase() === 'freddy.bremseth@gmail.com' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="Livstid-admin kan ikke slettes"><Crown className="h-3 w-3" /> Eier</span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(user)}
                          disabled={deletingId === user.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                          title={`Slett bruker ${user.email}`}
                        >
                          {deletingId === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Slett
                        </button>
                      )}
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
