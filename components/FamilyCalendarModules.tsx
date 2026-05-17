import React, { useMemo, useState } from 'react';
import { Bell, Brain, CalendarClock, CalendarDays, Car, CheckCircle2, CreditCard, FileText, FolderOpen, PackagePlus, Repeat, School, ShieldCheck, Users, Wallet } from 'lucide-react';
import { CalendarEvent, FamilyMember, Task, UserConfig } from '../types';

interface Props {
  familyMembers: FamilyMember[];
  selectedDate: string;
  userConfig: UserConfig;
  setCalendarEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onSelectDate: (date: string) => void;
}

type CalendarModuleId = 'recurrence' | 'reminders' | 'responsibility' | 'school' | 'documents' | 'resources' | 'liquidity' | 'ai' | 'marketplace';

const moduleCards: Array<{ id: CalendarModuleId; title: string; description: string; badge: string; icon: React.ReactNode; examples: string[] }> = [
  { id: 'recurrence', title: 'Gjentakelser og regler', description: 'Ukentlig, annenhver uke, månedlig, skolefri, ferier og egendefinerte regler.', badge: 'Kalender Pro', icon: <Repeat className="h-5 w-5" />, examples: ['Ukentlig fotballtrening', 'Annenhver uke hos tannlege', 'Månedlig forsikring'] },
  { id: 'reminders', title: 'Påminnelser', description: 'Push/e-post/SMS, flere varsler per hendelse og ansvarlig person.', badge: 'Varsler', icon: <Bell className="h-5 w-5" />, examples: ['2 dager før', 'Samme morgen', 'SMS til ansvarlig'] },
  { id: 'responsibility', title: 'Delt ansvar', description: 'Hvem kjører, hvem henter, hvem betaler, hvem må bekrefte.', badge: 'Familie', icon: <Users className="h-5 w-5" />, examples: ['Kjører: Freddy', 'Henter: Anna', 'Må bekreftes'] },
  { id: 'school', title: 'Familie-/skolekalender', description: 'Skolerute, helligdager, lokale fiestaer og import fra Google/Apple/Outlook.', badge: 'Import', icon: <School className="h-5 w-5" />, examples: ['Skolefri', 'Bank holiday', 'Google/Apple/Outlook'] },
  { id: 'documents', title: 'Avtaler og dokumenter', description: 'Koble hendelser til forsikring, kontrakt, legepapir, garanti eller kvittering.', badge: 'Dokumentlager', icon: <FileText className="h-5 w-5" />, examples: ['Forsikring', 'Kontrakt', 'Kvittering'] },
  { id: 'resources', title: 'Ressurser', description: 'Bil, bolig, rom, utstyr, kjæledyr, nøkler og lånte ting.', badge: 'Ressurs', icon: <Car className="h-5 w-5" />, examples: ['Bil', 'Nøkler', 'Kjæledyr'] },
  { id: 'liquidity', title: 'Likviditet fra kalender', description: 'Regninger, lønn, provisjon og forventede utgifter vist fremover.', badge: 'Økonomi', icon: <Wallet className="h-5 w-5" />, examples: ['Regning', 'Lønn', 'Provisjon'] },
  { id: 'ai', title: 'AI-forslag', description: 'Foreslå kategori, oppgave, varsling, dokument og hvem hendelsen gjelder.', badge: 'AI', icon: <Brain className="h-5 w-5" />, examples: ['Kategori', 'Ansvarlig', 'Varsel'] },
  { id: 'marketplace', title: 'Modulbutikk', description: 'Kjøp Kalender Pro, dokumentlager, kvittering/AI, bank/eiendeler og business.', badge: 'Add-ons', icon: <PackagePlus className="h-5 w-5" />, examples: ['Kalender Pro', 'Kvittering/AI', 'Business'] },
];

function plusDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function currency(amount: number) {
  return `${Math.round(amount).toLocaleString('nb-NO')} kr`;
}

export const FamilyCalendarModules: React.FC<Props> = ({ familyMembers, selectedDate, userConfig, setCalendarEvents, setTasks, onSelectDate }) => {
  const [active, setActive] = useState<CalendarModuleId>('recurrence');
  const [saved, setSaved] = useState<string | null>(null);
  const firstMember = familyMembers[0]?.id || '';
  const firstMemberName = familyMembers[0]?.name || 'Ansvarlig';
  const activeCard = useMemo(() => moduleCards.find((card) => card.id === active) || moduleCards[0], [active]);

  const addProEvent = (moduleId: CalendarModuleId) => {
    const base: any = { id: `cal-pro-${moduleId}-${Date.now()}`, date: selectedDate, startTime: moduleId === 'liquidity' ? '' : '09:00', endTime: moduleId === 'liquidity' ? '' : '10:00', assignedToId: firstMember, type: 'Appointment', sourceModule: moduleId };
    const presets: Record<CalendarModuleId, any> = {
      recurrence: { description: 'Ukentlig aktivitet · gjentas hver uke', recurrenceRule: { frequency: 'weekly', interval: 1, until: plusDays(selectedDate, 90), skipSchoolHolidays: false }, reminders: [{ channel: 'push', minutesBefore: 60 }] },
      reminders: { description: 'Viktig avtale med flere påminnelser', reminders: [{ channel: 'push', minutesBefore: 1440 }, { channel: 'email', minutesBefore: 180 }, { channel: 'sms', minutesBefore: 60 }] },
      responsibility: { description: 'Hente/kjøre/betale · delt ansvar', responsibility: { driver: firstMemberName, pickup: firstMemberName, payer: firstMemberName, confirmer: firstMemberName, requiresConfirmation: true } },
      school: { description: 'Skolefri / lokal helligdag', type: 'Holiday', localCalendar: { provider: 'manual', location: userConfig.location || 'NO', importSources: ['Google', 'Apple', 'Outlook'] } },
      documents: { description: 'Avtale med dokumentkobling', linkedDocuments: [{ title: 'Forsikring / kontrakt / kvittering', type: 'document', status: 'needs-link' }] },
      resources: { description: 'Ressursbooking · bil/nøkler/utstyr', resources: [{ type: 'Bil', name: 'Familiebil', status: 'reserved' }] },
      liquidity: { description: 'Forventet betaling fra kalender', type: 'Payment', liquidity: { amount: 1500, currency: 'NOK', direction: 'expense', category: 'Regning', affectsForecast: true } },
      ai: { description: 'AI-forslag: legetime for barn · legg til dokument og varsel', aiSuggestion: { category: 'Helse', suggestedResponsible: firstMemberName, suggestedReminder: '2 timer før', suggestedDocumentType: 'Legepapir' } },
      marketplace: { description: 'Aktiver modul fra kalenderen', modulePurchase: { moduleId: 'calendar-pro', status: 'preview', plan: 'addon' } },
    };
    setCalendarEvents((prev: any) => [...prev, { ...base, ...presets[moduleId] }]);
    setSaved(activeCard.title);
    setTimeout(() => setSaved(null), 2500);
  };

  const addChecklistTask = (moduleId: CalendarModuleId) => {
    const labels: Record<CalendarModuleId, string> = {
      recurrence: 'Sett gjentakelsesregel og unntak for skolefri/ferie', reminders: 'Velg push/e-post/SMS-varsler og ansvarlig mottaker', responsibility: 'Fordel kjøring, henting, betaling og bekreftelse', school: 'Importer skolerute og lokale helligdager for bosted', documents: 'Koble relevant dokument, kontrakt eller kvittering', resources: 'Reserver bil, nøkler, rom, utstyr eller kjæledyransvar', liquidity: 'Koble hendelsen til regning, lønn, provisjon eller utgift', ai: 'La AI foreslå kategori, ansvarlig, varsel og dokumentkobling', marketplace: 'Velg hvilke moduler familien skal kjøpe eller aktivere',
    };
    setTasks((prev: any) => [...prev, { id: `task-module-${moduleId}-${Date.now()}`, date: selectedDate, description: labels[moduleId], assignedToId: firstMember, priority: moduleId === 'liquidity' || moduleId === 'responsibility' ? 'High' : 'Medium', isComplete: false, sourceModule: moduleId }]);
    setSaved(`${activeCard.title} · oppgave`);
    setTimeout(() => setSaved(null), 2500);
  };

  const seedMonth = () => {
    const nextWeek = plusDays(selectedDate, 7);
    const payday = plusDays(selectedDate, 14);
    setCalendarEvents((prev: any) => [...prev,
      { id: `seed-school-${Date.now()}`, date: selectedDate, description: 'Skolerute / lokal helligdag fra bosted', type: 'Holiday', assignedToId: firstMember, localCalendar: { source: 'holiday-cache', location: userConfig.location || 'NO' } },
      { id: `seed-repeat-${Date.now()}`, date: nextWeek, startTime: '17:00', endTime: '18:00', description: 'Ukentlig aktivitet med påminnelse', type: 'Social', assignedToId: firstMember, recurrenceRule: { frequency: 'weekly', interval: 1 }, reminders: [{ channel: 'push', minutesBefore: 120 }] },
      { id: `seed-liquidity-${Date.now()}`, date: payday, description: 'Forventet innbetaling/utgift i likviditet', type: 'Payment', assignedToId: firstMember, liquidity: { amount: 35000, currency: 'NOK', direction: 'income', category: 'Lønn/provisjon', affectsForecast: true } },
    ]);
    onSelectDate(selectedDate);
    setSaved('Eksempelmoduler lagt inn');
    setTimeout(() => setSaved(null), 2500);
  };

  return (
    <section className="card p-4 md:p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="section-title text-lg"><CalendarClock className="h-5 w-5 text-indigo-500" /> Kalender Pro og familiemoduler</h2>
          <p className="section-subtitle max-w-3xl">Aktiver arbeidsflyter for gjentakelser, påminnelser, delt ansvar, skolekalender, dokumenter, ressurser, likviditet, AI-forslag og modulbutikk.</p>
        </div>
        <button onClick={seedMonth} className="btn-gradient min-h-[44px] justify-center"><ShieldCheck className="h-4 w-4" /> Legg inn eksempeloppsett</button>
      </div>
      {saved && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> {saved} lagt til.</div>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {moduleCards.map((module) => (
            <button key={module.id} onClick={() => setActive(module.id)} className={`rounded-2xl border p-4 text-left transition ${active === module.id ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50'}`}>
              <div className="mb-3 flex items-start justify-between gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active === module.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'}`}>{module.icon}</div><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${active === module.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>{module.badge}</span></div>
              <p className="font-black">{module.title}</p><p className={`mt-2 text-sm leading-6 ${active === module.id ? 'text-white/75' : 'text-slate-600'}`}>{module.description}</p>
            </button>
          ))}
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">{activeCard.icon}</div><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Valgt modul</p><h3 className="text-lg font-black text-slate-900">{activeCard.title}</h3></div></div>
          <p className="text-sm leading-6 text-slate-600">{activeCard.description}</p>
          <div className="mt-4 space-y-2">{activeCard.examples.map((example) => <div key={example} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {example}</div>)}</div>
          <div className="mt-5 grid grid-cols-1 gap-2"><button onClick={() => addProEvent(active)} className="btn-gradient min-h-[44px] justify-center"><CalendarDays className="h-4 w-4" /> Lag eksempel-hendelse</button><button onClick={() => addChecklistTask(active)} className="btn-secondary min-h-[44px] justify-center"><FolderOpen className="h-4 w-4" /> Lag sjekklisteoppgave</button></div>
          {active === 'liquidity' && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CreditCard className="mr-2 inline h-4 w-4" /> Likviditetseksempel: {currency(1500)} kan kobles til fremtidig saldo.</div>}
        </aside>
      </div>
    </section>
  );
};
