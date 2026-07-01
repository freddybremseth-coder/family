import React, { useEffect, useMemo, useState } from 'react';
import { CalendarEvent, FamilyMember, LocalEvent, Task, UserConfig } from '../types';
import { MEMBER_COLORS } from '../constants';
import { CheckCircle, ChevronLeft, ChevronRight, Circle, Clock, Edit3, Filter, Plus, Save, Trash2, User, Users, X } from 'lucide-react';
import { deleteCalendarEventFromSupabase, deleteTaskFromSupabase, ensureOfficialHolidays, loadCalendarPersistentData, syncCalendarEvents, syncTasks } from '../services/calendarPersistenceService';
import { supabase } from '../supabase';
import { AITaskChief } from './AITaskChief';

interface Props {
  familyMembers: FamilyMember[];
  calendarEvents: CalendarEvent[];
  setCalendarEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  userConfig: UserConfig;
  localEvents: LocalEvent[];
  setLocalEvents: React.Dispatch<React.SetStateAction<LocalEvent[]>>;
}

const WEEKDAYS_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EVENT_TYPES = ['Appointment', 'Meeting', 'Social', 'Travel', 'Holiday', 'Payment'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const PRIORITY_CONFIG: any = {
  Low: { label: 'Lav', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: '#10B981' },
  Medium: { label: 'Middels', color: 'bg-amber-100 text-amber-800 border-amber-200', dot: '#F59E0B' },
  High: { label: 'Høy', color: 'bg-red-100 text-red-800 border-red-200', dot: '#EF4444' },
};
const inputClass = 'input-field min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400';
const todayStr = () => new Date().toISOString().slice(0, 10);
const asAny = (value: any) => value;
const dateLabel = (date: string, language: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString(language === 'no' ? 'no-NO' : 'en-US', options);
const eventTime = (event: any) => event.startTime && event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime || 'Tid ikke satt';
const eventParticipants = (event: any) => Array.isArray(event.assignedToIds) && event.assignedToIds.length > 0 ? event.assignedToIds : (event.assignedToId ? [event.assignedToId] : []);
const taskParticipants = (task: any) => Array.isArray(task.assignedToIds) && task.assignedToIds.length > 0 ? task.assignedToIds : (task.assignedToId ? [task.assignedToId] : []);

function emptyEvent(date: string, memberId = ''): any {
  return { id: '', date, description: '', type: 'Social', startTime: '09:00', endTime: '', assignedToId: memberId, assignedToIds: memberId ? [memberId] : [] };
}
function emptyTask(date: string, memberId = ''): any {
  return { id: '', date, description: '', priority: 'Medium', assignedToId: memberId, assignedToIds: memberId ? [memberId] : [], isComplete: false };
}

export const FamilyCalendar: React.FC<Props> = ({ familyMembers, calendarEvents, setCalendarEvents, tasks, setTasks, userConfig, localEvents, setLocalEvents }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedMemberId, setSelectedMemberId] = useState('all');
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [calendarUserId, setCalendarUserId] = useState<string | null>(null);
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const defaultMemberId = familyMembers[0]?.id || '';

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId || cancelled) { setCalendarLoaded(true); return; }
      setCalendarUserId(userId);
      const loaded = await loadCalendarPersistentData(userId);
      if (cancelled) return;
      if (loaded.calendarEvents.length > 0) setCalendarEvents(loaded.calendarEvents);
      if (loaded.tasks.length > 0) setTasks(loaded.tasks);
      if (loaded.localEvents.length > 0) setLocalEvents(loaded.localEvents);
      const holidays = await ensureOfficialHolidays(userId, userConfig.location);
      if (!cancelled && holidays.length > 0) setLocalEvents(holidays);
      setCalendarLoaded(true);
    }).catch(() => setCalendarLoaded(true));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!calendarUserId || !calendarLoaded) return;
    const timer = setTimeout(() => syncCalendarEvents(calendarUserId, calendarEvents), 800);
    return () => clearTimeout(timer);
  }, [calendarEvents, calendarUserId, calendarLoaded]);

  useEffect(() => {
    if (!calendarUserId || !calendarLoaded) return;
    const timer = setTimeout(() => syncTasks(calendarUserId, tasks), 800);
    return () => clearTimeout(timer);
  }, [tasks, calendarUserId, calendarLoaded]);

  const getMemberColor = (id?: string) => MEMBER_COLORS[Math.max(0, familyMembers.findIndex(m => m.id === id)) % MEMBER_COLORS.length] || '#64748B';
  const getMemberName = (id?: string) => familyMembers.find(m => m.id === id)?.name || 'Alle';
  const participantNames = (ids: string[]) => ids.length === 0 ? 'Alle' : ids.map(getMemberName).join(', ');
  const itemVisible = (item: any) => selectedMemberId === 'all' || eventParticipants(item).includes(selectedMemberId) || taskParticipants(item).includes(selectedMemberId) || item.assignedToId === selectedMemberId;
  const filteredEvents = useMemo(() => (calendarEvents as any[]).filter(itemVisible), [calendarEvents, selectedMemberId]);
  const filteredTasks = useMemo(() => (tasks as any[]).filter(itemVisible), [tasks, selectedMemberId]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, selectedMonth, 1).getDay();
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    const days: Array<any | null> = [];
    for (let i = 0; i < padding; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = `${year}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, date, events: filteredEvents.filter(e => e.date === date), tasks: filteredTasks.filter(t => t.date === date), holidays: localEvents.filter(h => h.date === date) });
    }
    return days;
  }, [year, selectedMonth, filteredEvents, filteredTasks, localEvents]);

  const selectedDay = useMemo(() => ({
    events: filteredEvents.filter(e => e.date === selectedDate).sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99')),
    tasks: filteredTasks.filter(t => t.date === selectedDate),
    holidays: localEvents.filter(h => h.date === selectedDate),
  }), [selectedDate, filteredEvents, filteredTasks, localEvents]);

  const saveEvent = () => {
    if (!editingEvent?.description?.trim()) return;
    const participants = editingEvent.assignedToIds?.length ? editingEvent.assignedToIds : (editingEvent.assignedToId ? [editingEvent.assignedToId] : []);
    const row = { ...editingEvent, id: editingEvent.id || `event-${Date.now()}`, date: editingEvent.date || selectedDate, assignedToId: participants[0] || '', assignedToIds: participants };
    setCalendarEvents(prev => {
      const exists = (prev as any[]).some(event => event.id === row.id);
      return exists ? (prev as any[]).map(event => event.id === row.id ? row : event) as any : [...prev, row] as any;
    });
    setEditingEvent(null); setShowEventForm(false);
  };
  const saveTask = () => {
    if (!editingTask?.description?.trim()) return;
    const participants = editingTask.assignedToIds?.length ? editingTask.assignedToIds : (editingTask.assignedToId ? [editingTask.assignedToId] : []);
    const row = { ...editingTask, id: editingTask.id || `task-${Date.now()}`, date: editingTask.date || selectedDate, assignedToId: participants[0] || '', assignedToIds: participants };
    setTasks(prev => {
      const exists = (prev as any[]).some(task => task.id === row.id);
      return exists ? (prev as any[]).map(task => task.id === row.id ? row : task) as any : [...prev, row] as any;
    });
    setEditingTask(null); setShowTaskForm(false);
  };
  const removeEvent = (id: string) => { setCalendarEvents(prev => (prev as any[]).filter(event => event.id !== id) as any); if (calendarUserId) deleteCalendarEventFromSupabase(calendarUserId, id); };
  const removeTask = (id: string) => { setTasks(prev => (prev as any[]).filter(task => task.id !== id) as any); if (calendarUserId) deleteTaskFromSupabase(calendarUserId, id); };
  const toggleTask = (id: string) => setTasks(prev => (prev as any[]).map(task => task.id === id ? { ...task, isComplete: !task.isComplete, isDone: !task.isComplete } : task) as any);
  const toggleParticipant = (kind: 'event' | 'task', memberId: string) => {
    if (kind === 'event') setEditingEvent((prev: any) => { const ids = new Set(prev?.assignedToIds || []); ids.has(memberId) ? ids.delete(memberId) : ids.add(memberId); return { ...prev, assignedToIds: Array.from(ids), assignedToId: Array.from(ids)[0] || '' }; });
    else setEditingTask((prev: any) => { const ids = new Set(prev?.assignedToIds || []); ids.has(memberId) ? ids.delete(memberId) : ids.add(memberId); return { ...prev, assignedToIds: Array.from(ids), assignedToId: Array.from(ids)[0] || '' }; });
  };

  const monthName = new Date(year, selectedMonth).toLocaleString(userConfig.language === 'no' ? 'no-NO' : 'en-US', { month: 'long', year: 'numeric' });
  const activeMemberName = selectedMemberId === 'all' ? 'Alle i familien' : getMemberName(selectedMemberId);
  const completedCount = filteredTasks.filter(t => t.isComplete).length;
  const highPriority = filteredTasks.filter(t => t.priority === 'High' && !t.isComplete).slice(0, 5);
  const upcoming = filteredEvents.filter(e => e.date >= todayStr()).sort((a, b) => `${a.date} ${a.startTime || ''}`.localeCompare(`${b.date} ${b.startTime || ''}`)).slice(0, 6);

  return <div className="space-y-6 animate-fade-in">
    <section className="hero-gradient p-5 md:p-7 text-white">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="chip bg-white/20 text-white border border-white/20 mb-3">Familieplan</div><h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white">Kalender og aktiviteter</h1><p className="mt-2 max-w-2xl text-sm md:text-base text-white/85">Hendelser, oppgaver, helligdager og ansvar lagres i Supabase og kan redigeres etterpå.</p></div><div className="grid grid-cols-3 gap-2 md:min-w-[360px]"><div className="rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/75">Visning</p><p className="mt-1 text-sm font-bold truncate text-white">{activeMemberName}</p></div><div className="rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/75">Hendelser</p><p className="mt-1 text-xl font-extrabold text-white">{filteredEvents.length}</p></div><div className="rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/75">Oppgaver</p><p className="mt-1 text-xl font-extrabold text-white">{filteredTasks.length}</p></div></div></div>
    </section>

    <section className="card p-4 md:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="section-title text-lg"><Filter className="w-5 h-5 text-indigo-500" /> Velg familiemedlem</h2><p className="section-subtitle">En hendelse kan gjelde én eller flere personer.</p></div><div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setSelectedMemberId('all')} className={`min-h-[44px] shrink-0 rounded-2xl border px-4 py-2 text-sm font-bold ${selectedMemberId === 'all' ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><Users className="mr-2 inline h-4 w-4" />Alle</button>{familyMembers.map((member, index) => <button key={member.id} onClick={() => setSelectedMemberId(member.id)} className={`min-h-[44px] shrink-0 rounded-2xl border px-4 py-2 text-sm font-bold ${selectedMemberId === member.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: MEMBER_COLORS[index % MEMBER_COLORS.length] }} />{member.name}</button>)}</div></div></section>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><div className="xl:col-span-2 space-y-6">
      <section className="card p-4 md:p-6"><div className="mb-6 flex items-center justify-between"><button onClick={() => selectedMonth === 0 ? (setSelectedMonth(11), setYear(y => y - 1)) : setSelectedMonth(m => m - 1)} className="min-h-[44px] min-w-[44px] rounded-2xl hover:bg-slate-100 flex items-center justify-center"><ChevronLeft /></button><div className="text-center"><h3 className="font-extrabold text-xl text-slate-900 capitalize">{monthName}</h3><p className="text-xs text-slate-500 mt-1">{activeMemberName}</p></div><button onClick={() => selectedMonth === 11 ? (setSelectedMonth(0), setYear(y => y + 1)) : setSelectedMonth(m => m + 1)} className="min-h-[44px] min-w-[44px] rounded-2xl hover:bg-slate-100 flex items-center justify-center"><ChevronRight /></button></div><div className="grid grid-cols-7 gap-1.5 mb-2">{(userConfig.language === 'no' ? WEEKDAYS_NO : WEEKDAYS_EN).map(day => <div key={day} className="text-center text-xs font-bold text-slate-500 py-1 uppercase">{day}</div>)}</div><div className="grid grid-cols-7 gap-1.5">{calendarGrid.map((day, index) => <button key={index} disabled={!day} onClick={() => day && setSelectedDate(day.date)} className={`min-h-[70px] md:min-h-[92px] rounded-2xl p-2 text-left transition ${!day ? 'pointer-events-none opacity-0' : ''} ${day?.date === selectedDate ? 'bg-slate-900 text-white shadow-lg' : 'bg-white hover:bg-slate-50 border border-slate-100'} ${day?.date === todayStr() && day?.date !== selectedDate ? 'ring-2 ring-indigo-300 bg-indigo-50' : ''}`}>{day && <div className="flex h-full flex-col"><span className={`text-sm font-extrabold ${day.date === selectedDate ? 'text-white' : 'text-slate-800'}`}>{day.day}</span><div className="mt-auto flex flex-wrap gap-1 pt-2">{day.events.slice(0, 3).map((event: any, i: number) => <span key={`e-${i}`} className="h-2 w-2 rounded-full" style={{ background: day.date === selectedDate ? 'white' : getMemberColor(event.assignedToId) }} />)}{day.tasks.slice(0, 3).map((task: any, i: number) => <span key={`t-${i}`} className="h-2 w-2 rounded-full" style={{ background: day.date === selectedDate ? 'rgba(255,255,255,0.75)' : PRIORITY_CONFIG[task.priority || 'Medium'].dot }} />)}{day.holidays.length > 0 && <span className="h-2 w-2 rounded-full bg-sky-500" />}</div>{(day.events.length + day.tasks.length + day.holidays.length) > 3 && <span className={`mt-1 text-[10px] ${day.date === selectedDate ? 'text-white/80' : 'text-slate-400'}`}>+{day.events.length + day.tasks.length + day.holidays.length - 3}</span>}</div>}</button>)}</div></section>

      <section className="card p-4 md:p-6"><div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h3 className="section-title"><CalendarDaysIcon /> {dateLabel(selectedDate, userConfig.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3><p className="section-subtitle">{selectedDate === todayStr() ? 'I dag' : 'Plan for valgt dag'} · {activeMemberName}</p></div><div className="flex flex-wrap gap-2 w-full md:w-auto"><button onClick={() => { setEditingEvent(emptyEvent(selectedDate, defaultMemberId)); setShowEventForm(true); setShowTaskForm(false); }} className="btn-gradient justify-center min-h-[44px] flex-1 md:flex-none"><Plus className="w-4 h-4" /> Hendelse</button><button onClick={() => { setEditingTask(emptyTask(selectedDate, defaultMemberId)); setShowTaskForm(true); setShowEventForm(false); }} className="min-h-[44px] rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white flex items-center justify-center gap-2 flex-1 md:flex-none"><Plus className="w-4 h-4" /> Oppgave</button><AITaskChief tasks={tasks as any} familyMembers={familyMembers} onAddTask={(t) => { const id = `task-${Date.now()}`; setTasks(prev => [...prev as any, { id, ...t, isDone: false, isComplete: false, date: t.date || selectedDate }] as any); }} /></div></div>

        {showEventForm && editingEvent && <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><div className="mb-4 flex items-center justify-between"><div><h4 className="font-bold text-slate-900">{editingEvent.id ? 'Rediger hendelse' : 'Ny hendelse'}</h4><p className="text-sm text-slate-600">Endre tekst, dato, klokkeslett, type og hvilke personer hendelsen gjelder.</p></div><button onClick={() => setShowEventForm(false)} className="rounded-xl p-2 hover:bg-white"><X className="h-4 w-4" /></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><label className="md:col-span-2"><span className="text-sm font-semibold text-slate-700">Hva skjer?</span><input value={editingEvent.description || ''} onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })} className={`${inputClass} mt-1`} /></label><label><span className="text-sm font-semibold text-slate-700">Dato</span><input type="date" value={editingEvent.date || selectedDate} onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })} className={`${inputClass} mt-1`} /></label><label><span className="text-sm font-semibold text-slate-700">Type</span><select value={editingEvent.type || 'Social'} onChange={e => setEditingEvent({ ...editingEvent, type: e.target.value })} className={`${inputClass} mt-1`}>{EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label><label><span className="text-sm font-semibold text-slate-700">Starttid</span><input type="time" value={editingEvent.startTime || ''} onChange={e => setEditingEvent({ ...editingEvent, startTime: e.target.value })} className={`${inputClass} mt-1`} /></label><label><span className="text-sm font-semibold text-slate-700">Sluttid</span><input type="time" value={editingEvent.endTime || ''} onChange={e => setEditingEvent({ ...editingEvent, endTime: e.target.value })} className={`${inputClass} mt-1`} /></label><div className="md:col-span-2"><p className="text-sm font-semibold text-slate-700 mb-2">Gjelder personer</p><div className="flex flex-wrap gap-2">{familyMembers.map(member => { const active = (editingEvent.assignedToIds || []).includes(member.id); return <button type="button" key={member.id} onClick={() => toggleParticipant('event', member.id)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{member.name}</button>; })}</div></div><div className="md:col-span-2 grid grid-cols-2 gap-2"><button onClick={saveEvent} className="btn-gradient justify-center min-h-[44px]"><Save className="w-4 h-4" /> Lagre</button><button onClick={() => setShowEventForm(false)} className="btn-secondary min-h-[44px] justify-center"><X className="w-4 h-4" /> Avbryt</button></div></div></div>}

        {showTaskForm && editingTask && <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 p-4"><div className="mb-4 flex items-center justify-between"><div><h4 className="font-bold text-slate-900">{editingTask.id ? 'Rediger oppgave' : 'Ny oppgave'}</h4><p className="text-sm text-slate-600">Oppgaver kan også gjelde flere familiemedlemmer. Sett gjentakelse for faste ukentlige/månedlige oppgaver.</p></div><button onClick={() => setShowTaskForm(false)} className="rounded-xl p-2 hover:bg-white"><X className="h-4 w-4" /></button></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><label className="md:col-span-3"><span className="text-sm font-semibold text-slate-700">Hva må gjøres?</span><input value={editingTask.description || ''} onChange={e => setEditingTask({ ...editingTask, description: e.target.value })} className={`${inputClass} mt-1`} placeholder="F.eks. Hent brød, betal strøm, klipp gress" /></label><label><span className="text-sm font-semibold text-slate-700">Dato</span><input type="date" value={editingTask.date || selectedDate} onChange={e => setEditingTask({ ...editingTask, date: e.target.value })} className={`${inputClass} mt-1`} /></label><label><span className="text-sm font-semibold text-slate-700">Prioritet</span><select value={editingTask.priority || 'Medium'} onChange={e => setEditingTask({ ...editingTask, priority: e.target.value })} className={`${inputClass} mt-1`}>{PRIORITIES.map(priority => <option key={priority} value={priority}>{PRIORITY_CONFIG[priority].label}</option>)}</select></label><label><span className="text-sm font-semibold text-slate-700">🔁 Gjentakelse</span><select value={editingTask.recurrence || ''} onChange={e => setEditingTask({ ...editingTask, recurrence: e.target.value || undefined })} className={`${inputClass} mt-1`}><option value="">Ingen (én gang)</option><option value="daily">Hver dag</option><option value="weekly">Ukentlig</option><option value="biweekly">Annenhver uke</option><option value="monthly">Månedlig</option><option value="yearly">Årlig</option></select></label><div className="md:col-span-3"><p className="text-sm font-semibold text-slate-700 mb-2">Ansvarlige</p><div className="flex flex-wrap gap-2">{familyMembers.map(member => { const active = (editingTask.assignedToIds || []).includes(member.id); return <button type="button" key={member.id} onClick={() => toggleParticipant('task', member.id)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{member.name}</button>; })}</div></div>{editingTask.recurrence && <div className="md:col-span-3 rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800"><strong>🔁 Gjentakelse aktiv:</strong> Neste forekomst genereres automatisk når denne markeres ferdig eller passeres.</div>}<div className="md:col-span-3 grid grid-cols-2 gap-2"><button onClick={saveTask} className="btn-gradient justify-center min-h-[44px]"><Save className="w-4 h-4" /> Lagre</button><button onClick={() => setShowTaskForm(false)} className="btn-secondary min-h-[44px] justify-center"><X className="w-4 h-4" /> Avbryt</button></div></div></div>}

        <div className="space-y-5">{selectedDay.holidays.length > 0 && <div><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Helligdager / bank holidays</p><div className="space-y-2">{selectedDay.holidays.map((event, index) => <div key={`${event.date}-${index}`} className="rounded-2xl border border-sky-100 bg-sky-50 p-3"><p className="font-bold text-slate-900">{event.title || event.description}</p><p className="text-sm text-slate-600">{event.type}</p></div>)}</div></div>}{selectedDay.events.length > 0 && <div><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Hendelser</p><div className="space-y-2">{selectedDay.events.map(event => <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className="mt-1 h-10 w-1.5 rounded-full shrink-0" style={{ background: getMemberColor(event.assignedToId) }} /><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"><Clock className="w-3.5 h-3.5" /> {eventTime(event)}</span><span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700"><User className="w-3.5 h-3.5" /> {participantNames(eventParticipants(event))}</span></div><p className="font-bold text-slate-900">{event.description}</p><p className="text-sm text-slate-500">{event.type}</p></div></div><div className="flex gap-1"><button onClick={() => { setEditingEvent({ ...event, assignedToIds: eventParticipants(event) }); setShowEventForm(true); setShowTaskForm(false); }} className="min-h-[40px] min-w-[40px] rounded-xl text-slate-500 hover:bg-indigo-50"><Edit3 className="mx-auto w-4 h-4" /></button><button onClick={() => removeEvent(event.id)} className="min-h-[40px] min-w-[40px] rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="mx-auto w-4 h-4" /></button></div></div></div>)}</div></div>}{selectedDay.tasks.length > 0 && <div><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Oppgaver</p><div className="space-y-2">{selectedDay.tasks.map(task => <div key={task.id} className={`rounded-2xl border p-4 ${task.isComplete ? 'border-slate-100 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><button onClick={() => toggleTask(task.id)} className={`mt-0.5 min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center ${task.isComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{task.isComplete ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button><div className="min-w-0"><p className={`font-bold ${task.isComplete ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.description}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{participantNames(taskParticipants(task))}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${PRIORITY_CONFIG[task.priority || 'Medium'].color}`}>{PRIORITY_CONFIG[task.priority || 'Medium'].label}</span></div></div></div><div className="flex gap-1"><button onClick={() => { setEditingTask({ ...task, assignedToIds: taskParticipants(task) }); setShowTaskForm(true); setShowEventForm(false); }} className="min-h-[40px] min-w-[40px] rounded-xl text-slate-500 hover:bg-indigo-50"><Edit3 className="mx-auto w-4 h-4" /></button><button onClick={() => removeTask(task.id)} className="min-h-[40px] min-w-[40px] rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="mx-auto w-4 h-4" /></button></div></div></div>)}</div></div>}{selectedDay.tasks.length === 0 && selectedDay.events.length === 0 && selectedDay.holidays.length === 0 && <div className="empty-state py-12"><p className="font-bold text-slate-600">Ingen planer denne dagen</p><p className="text-sm text-slate-400 mt-1">Legg inn en hendelse eller oppgave med knappene ovenfor.</p></div>}</div>
      </section>
    </div><aside className="space-y-6"><section className="card p-5"><h3 className="section-title text-base mb-5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Fullføring</h3><div className="flex justify-between items-end mb-2"><span className="text-sm text-slate-600">{completedCount} av {filteredTasks.length} fullført</span><span className="text-2xl font-extrabold text-indigo-600">{filteredTasks.length ? Math.round((completedCount / filteredTasks.length) * 100) : 0}%</span></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${filteredTasks.length ? (completedCount / filteredTasks.length) * 100 : 0}%`, background: '#10B981' }} /></div></section><section className="card p-5"><h3 className="section-title text-base mb-4"><Clock className="w-4 h-4 text-indigo-500" /> Neste aktiviteter</h3>{upcoming.length > 0 ? <div className="space-y-2">{upcoming.map(event => <button key={event.id} onClick={() => setSelectedDate(event.date)} className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-indigo-50"><p className="text-sm font-bold text-slate-900 truncate">{event.description}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(event.date, userConfig.language, { day: 'numeric', month: 'short' })} · {eventTime(event)} · {participantNames(eventParticipants(event))}</p></button>)}</div> : <p className="text-sm text-slate-500">Ingen kommende hendelser.</p>}</section>{highPriority.length > 0 && <section className="card p-5 border-red-100 bg-red-50"><h3 className="section-title text-base mb-4">Viktige oppgaver</h3><div className="space-y-2">{highPriority.map(task => <button key={task.id} onClick={() => setSelectedDate(task.date)} className="w-full p-3 bg-white border border-red-100 rounded-2xl text-left"><p className="text-sm font-bold text-slate-900 truncate">{task.description}</p><p className="text-xs text-slate-500 mt-1">{participantNames(taskParticipants(task))}</p></button>)}</div></section>}</aside></div>
  </div>;
};

function CalendarDaysIcon() { return <span className="inline-block h-5 w-5 rounded-full bg-indigo-500 align-middle" />; }
