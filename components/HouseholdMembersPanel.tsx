import React, { useEffect, useState } from 'react';
import { Crown, Loader2, Mail, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import {
  getOrCreateHousehold, listHouseholdMembers, inviteHouseholdMember,
  removeHouseholdMember, Household, HouseholdMember,
} from '../services/householdService';
import { supabase } from '../supabase';

interface Props { userId?: string; familyName?: string; currentUserEmail?: string | null; }

export const HouseholdMembersPanel: React.FC<Props> = ({ userId, familyName = 'Familien', currentUserEmail }) => {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<HouseholdMember['role']>('member');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const hh = await getOrCreateHousehold(userId, familyName);
      setHousehold(hh);
      if (hh && !hh.isLocalFallback) {
        const mem = await listHouseholdMembers(hh.id);
        setMembers(mem);
      } else {
        setMembers([]);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [userId, familyName]);

  const isOwner = household?.ownerUserId === userId;

  const handleInvite = async () => {
    setError(null); setMessage(null);
    if (!household) { setError('Fant ikke household.'); return; }
    if (!inviteEmail.trim()) { setError('Skriv inn e-post.'); return; }
    setInviting(true);
    try {
      await inviteHouseholdMember(household.id, inviteEmail, inviteName || inviteEmail.split('@')[0], inviteRole);
      setMessage(`Invitasjon opprettet for ${inviteEmail}. Neste gang de logger inn (eller oppretter konto med samme e-post), kobles de automatisk til «${household.name}».`);
      setInviteEmail(''); setInviteName(''); setInviteRole('member');
      await reload();
    } catch (e: any) {
      setError(e?.message || 'Klarte ikke å opprette invitasjon.');
    } finally { setInviting(false); }
  };

  const handleRemove = async (member: HouseholdMember) => {
    if (member.role === 'owner') { setError('Kan ikke fjerne eier.'); return; }
    if (!confirm(`Fjerne ${member.name} fra husholdningen?`)) return;
    setError(null);
    try {
      await removeHouseholdMember(member.id);
      await reload();
    } catch (e: any) { setError(e?.message || 'Klarte ikke å fjerne medlem.'); }
  };

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/app.html?mode=signup`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage(`Invitasjonslenke kopiert: ${link}`);
    } catch {
      setMessage(`Send denne lenken: ${link}`);
    }
  };

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">Laster household...</div>;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Users className="h-5 w-5" /></div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900">Familiemedlemmer med tilgang</h3>
          <p className="text-sm text-slate-500">{household?.name} · Inviter flere personer til å bruke husholdningen.</p>
        </div>
      </div>

      {message && <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {household?.isLocalFallback && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-bold">Denne kontoen bruker lokal fallback — invitasjoner krever at Supabase er koblet til.</p>
          {household.fallbackReason && (
            <p className="mt-2 font-mono text-xs whitespace-pre-wrap break-all">Feil fra Supabase: {household.fallbackReason}</p>
          )}
          <button
            onClick={() => { setError(null); setMessage(null); try { localStorage.removeItem('familyhub_local_household'); } catch {} reload(); }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
          >
            Prøv å koble til på nytt
          </button>
          <p className="mt-2 text-xs text-amber-700">Sjekk også Browser Console (Cmd+Opt+I) for full stack-trace.</p>
        </div>
      )}

      {/* Medlem-liste */}
      <div className="space-y-2 mb-4">
        {members.length === 0 && !household?.isLocalFallback ? (
          <p className="text-sm text-slate-500 italic">Ingen andre medlemmer ennå. Bruk skjemaet under for å invitere.</p>
        ) : (
          members.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${m.role === 'owner' ? 'bg-amber-100 text-amber-700' : m.status === 'pending' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                  {m.role === 'owner' ? <Crown className="h-4 w-4" /> : m.status === 'pending' ? <Mail className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{m.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {m.role === 'owner' ? 'Eier' : m.role === 'admin' ? 'Admin' : m.role === 'child' ? 'Barn' : 'Medlem'}
                    {' · '}
                    {m.status === 'pending' ? (
                      <>Invitert{m.invitedEmail ? ` (${m.invitedEmail})` : ''}</>
                    ) : (
                      <>Aktiv{m.joinedAt ? ` siden ${new Date(m.joinedAt).toLocaleDateString('nb-NO')}` : ''}</>
                    )}
                  </p>
                </div>
              </div>
              {isOwner && m.role !== 'owner' && (
                <button onClick={() => handleRemove(m)} className="p-2 text-slate-400 hover:text-rose-600" title="Fjern medlem"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Invite-skjema */}
      {isOwner && !household?.isLocalFallback && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Inviter nytt medlem</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="E-post" className="md:col-span-2" />
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Navn (valgfritt)" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as HouseholdMember['role'])}>
              <option value="member">Medlem</option>
              <option value="admin">Admin</option>
              <option value="child">Barn</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleInvite} disabled={inviting} className="btn-primary">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Opprett invitasjon
            </button>
            <button onClick={copyInviteLink} type="button" className="btn-secondary">
              <Mail className="h-4 w-4" /> Kopier invitasjonslenke
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            💡 Personen må opprette konto (eller logge inn) med den samme e-posten du inviterte. Da kobles kontoen automatisk til «{household?.name}».
          </p>
        </div>
      )}
    </div>
  );
};
