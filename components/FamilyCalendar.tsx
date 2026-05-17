
import React, { useMemo, useState } from 'react';
import { FamilyMember, CalendarEvent, Task, LocalEvent, UserConfig } from '../types';
import { translations } from '../translations';
import { MEMBER_COLORS } from '../constants';
import { FamilyCalendarModules } from './FamilyCalendarModules';
import {
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  User,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  Users,
  Filter,
} from 'lucide-react';

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

const EVENT_TYPES: Array<{ value: CalendarEvent['type']; label: string }> = [
  { value: 'Appointment', label: 'Avtale' },
  { value: 'Meeting', label: 'Møte' },
  { value: 'Social', label: 'Sosialt' },
  { value: 'Travel', label: 'Reise' },
];

const PRIORITY_CONFIG = {
  Low: { label: 'Lav', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: '#10B981' },
  Medium: { label: 'Middels', color: 'bg-amber-100 text-amber-800 border-amber-200', dot: '#F59E0B' },
  High: { label: 'Høy', color: 'bg-red-100 text-red-800 border-red-200', dot: '#EF4444' },
};

const inputClass = 'input-field min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400';

const formatDate = (date: string, language: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(language === 'no' ? 'no-NO' : 'en-US', options);

const formatEventTime = (event: Partial<CalendarEvent>) => {
  if ((event as any).startTime && (event as any).endTime) return `${(event as any).startTime}–${(event as any).endTime}`;
  if ((event as any).startTime) return (event as any).startTime;
  return 'Tid ikke satt';
};

export const FamilyCalendar: React.FC<Props> = ({
  familyMembers,
  calendarEvents,
  setCalendarEvents,
  tasks,
  setTasks,
  userConfig,
  localEvents,
}) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const t = translations[userConfig.language];

  const defaultMemberId = familyMembers[0]?.id || '';

  const [newTask, setNewTask] = useState<Partial<Task>>({
    description: '',
    priority: 'Medium',
    assignedToId: defaultMemberId,
    isComplete: false,
  } as any);

  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    description: '',
    type: 'Social',
    assignedToId: defaultMemberId,
    startTime: '09:00',
    endTime: '',
  } as any);

  const getMemberColor = (id?: string) => {
    const idx = familyMembers.findIndex(m => m.id === id);
    return idx >= 0 ? MEMBER_COLORS[idx % MEMBER_COLORS.length] : '#64748B';
  };

  const getMemberName = (id?: string) => familyMembers.find(m => m.id === id)?.name || 'Alle';

  const isVisibleForMember = (item: { assignedToId?: string }) =>
    selectedMemberId === 'all' || !item.assignedToId || item.assignedToId === selectedMemberId;

  const filteredTasks = useMemo(() => (tasks as any[]).filter(isVisibleForMember), [tasks, selectedMemberId]);
  const filteredEvents = useMemo(() => (calendarEvents as any[]).filter(isVisibleForMember), [calendarEvents, selectedMemberId]);

  const handleAddTask = () => {
    if (!(newTask as any).description?.trim()) return;

    setTasks(prev => [...prev, {
      id: `task-${Date.now()}`,
      date: selectedDate,
      description: (newTask as any).description!.trim(),
      assignedToId: (newTask as any).assignedToId || defaultMemberId,
      priority: (newTask as any).priority as 'Low' | 'Medium' | 'High',
      isComplete: false,
    } as any]);

    setNewTask(prev => ({ ...prev, description: '' } as any));
    setShowTaskForm(false);
  };

  const handleAddEvent = () => {
    if (!(newEvent as any).description?.trim()) return;

    setCalendarEvents(prev => [...prev, {
      id: `event-${Date.now()}`,
      date: selectedDate,
      startTime: (newEvent as any).startTime || '',
      endTime: (newEvent as any).endTime || '',
      description: (newEvent as any).description!.trim(),
      assignedToId: (newEvent as any).assignedToId || defaultMemberId,
      type: (newEvent as any).type as CalendarEvent['type'],
    } as any]);

    setNewEvent(prev => ({ ...prev, description: '', startTime: (prev as any).startTime || '09:00', endTime: '' } as any));
    setShowEventForm(false);
  };

  const toggleTask = (id: string) =>
    setTasks(prev => (prev as any[]).map(task => task.id === id ? { ...task, isComplete: !task.isComplete } : task) as any);

  const deleteTask = (id: string) => setTasks(prev => (prev as any[]).filter(task => task.id !== id) as any);
  const deleteEvent = (id: string) => setCalendarEvents(prev => (prev as any[]).filter(event => event.id !== id) as any);

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, selectedMonth, 1).getDay();
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    const days: Array<null | { day: number; dateStr: string; tasks: any[]; events: any[]; localEvents: LocalEvent[] }> = [];

    for (let i = 0; i < padding; i++) days.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        dateStr,
        tasks: filteredTasks.filter(task => task.date === dateStr),
        events: filteredEvents.filter(event => event.date === dateStr),
        localEvents: localEvents.filter(event => event.date === dateStr),
      });
    }

    return days;
  }, [selectedMonth, year, filteredTasks, filteredEvents, localEvents]);

  const selectedDayData = useMemo(() => {
    const eventsForDay = filteredEvents
      .filter(event => event.date === selectedDate)
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));

    const localEventsForDay = localEvents.filter(event => event.date === selectedDate);
    const tasksForDay = filteredTasks.filter(task => task.date === selectedDate);

    return { events: eventsForDay, localEvents: localEventsForDay, tasks: tasksForDay };
  }, [selectedDate, filteredEvents, filteredTasks, localEvents]);

  const todayStr = new Date().toISOString().split('T')[0];
  const monthName = new Date(year, selectedMonth).toLocaleString(
    userConfig.language === 'no' ? 'no-NO' : 'en-US',
    { month: 'long', year: 'numeric' }
  );

  const completedCount = filteredTasks.filter(task => task.isComplete).length;
  const totalCount = filteredTasks.length;
  const highPriorityPending = filteredTasks.filter(task => task.priority === 'High' && !task.isComplete);
  const upcomingEvents = filteredEvents
    .filter(event => event.date >= todayStr)
    .sort((a, b) => `${a.date} ${a.startTime || ''}`.localeCompare(`${b.date} ${b.startTime || ''}`))
    .slice(0, 5);

  const weekdays = userConfig.language === 'no' ? WEEKDAYS_NO : WEEKDAYS_EN;
  const activeMemberName = selectedMemberId === 'all' ? 'Alle i familien' : getMemberName(selectedMemberId);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="hero-gradient p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="chip bg-white/20 text-white border border-white/20 mb-3">
              Familieplan 2026
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">Kalender og aktiviteter</h1>
            <p className="mt-2 max-w-2xl text-sm md:text-base text-white/85">
              Planlegg avtaler, oppgaver og familieaktiviteter med klokkeslett, ansvarlig person og tydelig oversikt på mobil og iPad.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
            <div className="rounded-2xl bg-white/15 p-3 text-white backdrop-blur">
              <p className="text-xs text-white/75">Valgt visning</p>
              <p className="mt-1 text-sm font-bold truncate">{activeMemberName}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3 text-white backdrop-blur">
              <p className="text-xs text-white/75">Hendelser</p>
              <p className="mt-1 text-xl font-extrabold">{filteredEvents.length}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3 text-white backdrop-blur">
              <p className="text-xs text-white/75">Oppgaver</p>
              <p className="mt-1 text-xl font-extrabold">{filteredTasks.length}</p>
            </div>
          </div>
        </div>
      </section>

      <FamilyCalendarModules familyMembers={familyMembers} selectedDate={selectedDate} userConfig={userConfig} setCalendarEvents={setCalendarEvents} setTasks={setTasks} onSelectDate={setSelectedDate} />

      <section className="card p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="section-title text-lg">
              <Filter className="w-5 h-5 text-indigo-500" />
              Velg familiemedlem
            </h2>
            <p className="section-subtitle">Trykk på en person for å se alt som er planlagt for denne personen.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setSelectedMemberId('all')}
              className={`min-h-[44px] shrink-0 rounded-2xl border px-4 py-2 text-sm font-bold transition-all ${
                selectedMemberId === 'all'
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <span className="inline-flex items-center gap-2"><Users className="w-4 h-4" /> Alle</span>
            </button>
            {familyMembers.map((member, index) => (
              <button
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`min-h-[44px] shrink-0 rounded-2xl border px-4 py-2 text-sm font-bold transition-all ${
                  selectedMemberId === member.id
                    ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: MEMBER_COLORS[index % MEMBER_COLORS.length] }}
                  />
                  {member.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section className="card p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="min-h-[44px] min-w-[44px] rounded-2xl hover:bg-slate-100 transition-colors text-slate-600 flex items-center justify-center" aria-label="Forrige måned">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h3 className="font-extrabold text-xl text-slate-900 capitalize">{monthName}</h3>
                <p className="text-xs text-slate-500 mt-1">{activeMemberName}</p>
              </div>
              <button onClick={nextMonth} className="min-h-[44px] min-w-[44px] rounded-2xl hover:bg-slate-100 transition-colors text-slate-600 flex items-center justify-center" aria-label="Neste måned">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {weekdays.map(day => (
                <div key={day} className="text-center text-[11px] md:text-xs font-bold text-slate-500 py-1 uppercase tracking-wide">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarGrid.map((day, index) => (
                <button
                  key={index}
                  disabled={!day}
                  onClick={() => day && setSelectedDate(day.dateStr)}
                  className={`min-h-[64px] md:min-h-[86px] rounded-2xl p-1.5 md:p-2 text-left transition-all ${
                    !day ? 'pointer-events-none opacity-0' : ''
                  } ${day?.dateStr === selectedDate ? 'bg-slate-900 text-white shadow-lg' : 'bg-white hover:bg-slate-50 border border-slate-100'} ${
                    day?.dateStr === todayStr && day?.dateStr !== selectedDate ? 'ring-2 ring-indigo-300 bg-indigo-50' : ''
                  }`}
                >
                  {day && (
                    <div className="flex h-full flex-col">
                      <span className={`text-xs md:text-sm font-extrabold ${day.dateStr === selectedDate ? 'text-white' : 'text-slate-800'}`}>{day.day}</span>
                      <div className="mt-auto flex flex-wrap gap-1 pt-2">
                        {day.events.slice(0, 3).map((event, eventIndex) => (
                          <span
                            key={`event-${eventIndex}`}
                            className="h-2 w-2 rounded-full"
                            style={{ background: day.dateStr === selectedDate ? 'white' : getMemberColor(event.assignedToId) }}
                          />
                        ))}
                        {day.tasks.slice(0, 3).map((task, taskIndex) => (
                          <span
                            key={`task-${taskIndex}`}
                            className="h-2 w-2 rounded-full"
                            style={{ background: day.dateStr === selectedDate ? 'rgba(255,255,255,0.7)' : PRIORITY_CONFIG[task.priority].dot }}
                          />
                        ))}
                        {day.localEvents.length > 0 && (
                          <span className="h-2 w-2 rounded-full bg-sky-500" />
                        )}
                      </div>
                      {(day.events.length + day.tasks.length + day.localEvents.length) > 3 && (
                        <span className={`mt-1 text-[10px] ${day.dateStr === selectedDate ? 'text-white/80' : 'text-slate-400'}`}>
                          +{day.events.length + day.tasks.length + day.localEvents.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="card p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
              <div>
                <h3 className="section-title">
                  <CalendarDays className="w-5 h-5 text-indigo-500" />
                  {formatDate(selectedDate, userConfig.language, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <p className="section-subtitle">
                  {selectedDate === todayStr ? 'I dag' : 'Plan for valgt dag'} · {activeMemberName}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                <button
                  onClick={() => { setShowEventForm(!showEventForm); setShowTaskForm(false); }}
                  className="btn-gradient justify-center min-h-[44px]"
                >
                  <Plus className="w-4 h-4" /> Hendelse
                </button>
                <button
                  onClick={() => { setShowTaskForm(!showTaskForm); setShowEventForm(false); }}
                  className="min-h-[44px] rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-amber-100 transition hover:bg-amber-600 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Oppgave
                </button>
              </div>
            </div>

            {showEventForm && (
              <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 animate-fade-in">
                <div className="mb-4">
                  <h4 className="font-bold text-slate-900">Ny hendelse</h4>
                  <p className="text-sm text-slate-600">Legg inn aktivitet, klokkeslett og hvem den gjelder.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="md:col-span-2">
                    <span className="text-sm font-semibold text-slate-700">Hva skjer?</span>
                    <input
                      value={(newEvent as any).description || ''}
                      onChange={e => setNewEvent({ ...newEvent, description: e.target.value } as any)}
                      placeholder="F.eks. fotballtrening, møte, legetime eller visning"
                      className={`${inputClass} mt-1`}
                      onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
                    />
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">Starttid</span>
                    <input
                      type="time"
                      value={(newEvent as any).startTime || ''}
                      onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value } as any)}
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">Sluttid, valgfritt</span>
                    <input
                      type="time"
                      value={(newEvent as any).endTime || ''}
                      onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value } as any)}
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">Type</span>
                    <select
                      value={(newEvent as any).type}
                      onChange={e => setNewEvent({ ...newEvent, type: e.target.value as CalendarEvent['type'] } as any)}
                      className={`${inputClass} mt-1`}
                    >
                      {EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">Gjelder</span>
                    <select
                      value={(newEvent as any).assignedToId || defaultMemberId}
                      onChange={e => setNewEvent({ ...newEvent, assignedToId: e.target.value } as any)}
                      className={`${inputClass} mt-1`}
                    >
                      {familyMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                  </label>
                  <div className="md:col-span-2 grid grid-cols-2 gap-2">
                    <button onClick={handleAddEvent} className="btn-gradient justify-center min-h-[44px]">
                      <Save className="w-4 h-4" /> Lagre hendelse
                    </button>
                    <button onClick={() => setShowEventForm(false)} className="btn-secondary min-h-[44px] flex items-center justify-center gap-2">
                      <X className="w-4 h-4" /> Avbryt
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showTaskForm && (
              <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 animate-fade-in">
                <div className="mb-4">
                  <h4 className="font-bold text-slate-900">Ny oppgave</h4>
                  <p className="text-sm text-slate-600">Lag en oppgave og velg ansvarlig familiemedlem.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="md:col-span-2">
                    <span className="text-sm font-semibold text-slate-700">Hva må gjøres?</span>
                    <input
                      value={(newTask as any).description || ''}
                      onChange={e => setNewTask({ ...newTask, description: e.target.value } as any)}
                      placeholder="F.eks. handle, hente, ringe eller betale"
                      className={`${inputClass} mt-1`}
                      onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                    />
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">Prioritet</span>
                    <select
                      value={(newTask as any).priority}
                      onChange={e => setNewTask({ ...newTask, priority: e.target.value as any } as any)}
                      className={`${inputClass} mt-1`}
                    >
                      <option value="Low">Lav prioritet</option>
                      <option value="Medium">Middels prioritet</option>
                      <option value="High">Høy prioritet</option>
                    </select>
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">Ansvarlig</span>
                    <select
                      value={(newTask as any).assignedToId || defaultMemberId}
                      onChange={e => setNewTask({ ...newTask, assignedToId: e.target.value } as any)}
                      className={`${inputClass} mt-1`}
                    >
                      {familyMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                  </label>
                  <div className="md:col-span-2 grid grid-cols-2 gap-2">
                    <button onClick={handleAddTask} className="btn-gradient justify-center min-h-[44px]">
                      <Save className="w-4 h-4" /> Legg til oppgave
                    </button>
                    <button onClick={() => setShowTaskForm(false)} className="btn-secondary min-h-[44px] flex items-center justify-center gap-2">
                      <X className="w-4 h-4" /> Avbryt
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {selectedDayData.localEvents.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Lokale merkedager</p>
                  <div className="space-y-2">
                    {selectedDayData.localEvents.map((event, index) => (
                      <div key={`${event.date}-${index}`} className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                        <p className="font-bold text-slate-900">{event.title || event.description}</p>
                        <p className="text-sm text-slate-600">{event.type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDayData.events.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Hendelser</p>
                  <div className="space-y-2">
                    {selectedDayData.events.map(event => (
                      <div key={event.id} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <div
                              className="mt-1 h-10 w-1.5 rounded-full shrink-0"
                              style={{ background: getMemberColor(event.assignedToId) }}
                            />
                            <div className="min-w-0">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                                  <Clock className="w-3.5 h-3.5" /> {formatEventTime(event)}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                                  <User className="w-3.5 h-3.5" /> {getMemberName(event.assignedToId)}
                                </span>
                                {event.sourceModule && <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{event.sourceModule}</span>}
                              </div>
                              <p className="font-bold text-slate-900">{event.description}</p>
                              <p className="text-sm text-slate-500">{EVENT_TYPES.find(type => type.value === event.type)?.label || event.type}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="min-h-[40px] min-w-[40px] rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center"
                            aria-label="Slett hendelse"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDayData.tasks.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Oppgaver</p>
                  <div className="space-y-2">
                    {selectedDayData.tasks.map(task => (
                      <div
                        key={task.id}
                        className={`rounded-2xl border p-4 transition ${
                          task.isComplete ? 'border-slate-100 bg-slate-50 opacity-70' : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <button
                              onClick={() => toggleTask(task.id)}
                              className={`mt-0.5 min-h-[40px] min-w-[40px] rounded-xl transition flex items-center justify-center ${
                                task.isComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
                              }`}
                              aria-label="Endre oppgavestatus"
                            >
                              {task.isComplete ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </button>
                            <div className="min-w-0">
                              <p className={`font-bold ${task.isComplete ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.description}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                                  <span className="h-2 w-2 rounded-full" style={{ background: getMemberColor(task.assignedToId) }} />
                                  {getMemberName(task.assignedToId)}
                                </span>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${PRIORITY_CONFIG[task.priority].color}`}>
                                  {PRIORITY_CONFIG[task.priority].label}
                                </span>
                                {task.sourceModule && <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{task.sourceModule}</span>}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="min-h-[40px] min-w-[40px] rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center"
                            aria-label="Slett oppgave"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDayData.tasks.length === 0 && selectedDayData.events.length === 0 && selectedDayData.localEvents.length === 0 && (
                <div className="empty-state py-12">
                  <div className="empty-state-icon">
                    <CalendarDays className="w-9 h-9" />
                  </div>
                  <p className="font-bold text-slate-600">Ingen planer denne dagen</p>
                  <p className="text-sm text-slate-400 mt-1">Legg inn en hendelse eller oppgave med knappene ovenfor.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h3 className="section-title text-base mb-5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Fullføring
            </h3>
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm text-slate-600">{completedCount} av {totalCount} fullført</span>
              <span className="text-2xl font-extrabold text-indigo-600">
                {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`, background: '#10B981' }}
              />
            </div>
          </section>

          <section className="card p-5">
            <h3 className="section-title text-base mb-4">
              <Clock className="w-4 h-4 text-indigo-500" />
              Neste aktiviteter
            </h3>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                {upcomingEvents.map(event => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedDate(event.date)}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    <p className="text-sm font-bold text-slate-900 truncate">{event.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(event.date, userConfig.language, { day: 'numeric', month: 'short' })} · {formatEventTime(event)} · {getMemberName(event.assignedToId)}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Ingen kommende hendelser i valgt visning.</p>
            )}
          </section>

          {highPriorityPending.length > 0 && (
            <section className="card p-5 border-red-100 bg-red-50">
              <h3 className="section-title text-base mb-4">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Viktige oppgaver
              </h3>
              <div className="space-y-2">
                {highPriorityPending.slice(0, 5).map(task => (
                  <button
                    key={task.id}
                    className="w-full p-3 bg-white border border-red-100 rounded-2xl text-left hover:border-red-200 transition-colors"
                    onClick={() => setSelectedDate(task.date)}
                  >
                    <p className="text-sm font-bold text-slate-900 truncate">{task.description}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {getMemberName(task.assignedToId)} · {formatDate(task.date, userConfig.language, { day: 'numeric', month: 'short' })}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {familyMembers.length > 0 && (
            <section className="card p-5">
              <h3 className="section-title text-base mb-4">
                <User className="w-4 h-4 text-indigo-500" />
                Familiestatus
              </h3>
              <div className="space-y-3">
                {familyMembers.map((member, index) => {
                  const memberTasks = filteredTasks.filter(task => task.assignedToId === member.id);
                  const memberEvents = filteredEvents.filter(event => event.assignedToId === member.id);
                  const done = memberTasks.filter(task => task.isComplete).length;
                  const percent = memberTasks.length > 0 ? (done / memberTasks.length) * 100 : 0;

                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMemberId(member.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        selectedMemberId === member.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: MEMBER_COLORS[index % MEMBER_COLORS.length] }}
                        >
                          {member.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">{member.name}</p>
                          <p className="text-xs text-slate-500">{memberEvents.length} hendelser · {done}/{memberTasks.length} oppgaver</p>
                        </div>
                      </div>
                      {memberTasks.length > 0 && (
                        <div className="progress-bar mt-3">
                          <div
                            className="progress-fill"
                            style={{ width: `${percent}%`, background: MEMBER_COLORS[index % MEMBER_COLORS.length] }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};
