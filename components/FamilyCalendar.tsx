
import React, { useState, useMemo } from 'react';
import { FamilyMember, CalendarEvent, Task, LocalEvent, UserConfig } from '../types';
import { translations } from '../translations';
import { MEMBER_COLORS } from '../constants';
import {
  CalendarDays, Plus, Trash2, CheckCircle, Circle, User,
  X, Save, ChevronLeft, ChevronRight, AlertCircle
} from 'lucide-react';
import { CyberButton } from './CyberButton';

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

const PRIORITY_CONFIG = {
  Low:    { label: 'Lav',     color: 'bg-emerald-100 text-emerald-700', dot: '#10B981' },
  Medium: { label: 'Middels', color: 'bg-amber-100 text-amber-700',     dot: '#F59E0B' },
  High:   { label: 'Høy',     color: 'bg-red-100 text-red-700',         dot: '#EF4444' },
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
  const t = translations[userConfig.language];

  const [newTask, setNewTask] = useState<Partial<Task>>({
    description: '', priority: 'Medium',
    assignedToId: familyMembers[0]?.id || '', isComplete: false,
  });

  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    description: '', type: 'Social',
    assignedToId: familyMembers[0]?.id || '',
  });

  const getMemberColor = (id: string) => {
    const idx = familyMembers.findIndex(m => m.id === id);
    return MEMBER_COLORS[idx % MEMBER_COLORS.length] || '#4F46E5';
  };

  const getMemberName = (id: string) =>
    familyMembers.find(m => m.id === id)?.name || 'Alle';

  const handleAddTask = () => {
    if (!newTask.description?.trim()) return;
    setTasks(prev => [...prev, {
      id: `task-${Date.now()}`,
      date: selectedDate,
      description: newTask.description!.trim(),
      assignedToId: newTask.assignedToId || '',
      priority: newTask.priority as 'Low' | 'Medium' | 'High',
      isComplete: false,
    }]);
    setNewTask({ ...newTask, description: '' });
    setShowTaskForm(false);
  };

  const handleAddEvent = () => {
    if (!newEvent.description?.trim()) return;
    setCalendarEvents(prev => [...prev, {
      id: `event-${Date.now()}`,
      date: selectedDate,
      description: newEvent.description!.trim(),
      assignedToId: newEvent.assignedToId || '',
      type: newEvent.type as any,
    }]);
    setNewEvent({ ...newEvent, description: '' });
    setShowEventForm(false);
  };

  const toggleTask = (id: string) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isComplete: !t.isComplete } : t));

  const deleteTask = (id: string) =>
    setTasks(prev => prev.filter(t => t.id !== id));

  const deleteEvent = (id: string) =>
    setCalendarEvents(prev => prev.filter(e => e.id !== id));

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, selectedMonth, 1).getDay();
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    const days: any[] = [];

    for (let i = 0; i < padding; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        dateStr,
        tasks: tasks.filter(t => t.date === dateStr),
        events: [...calendarEvents, ...localEvents].filter(e => e.date === dateStr),
      });
    }
    return days;
  }, [selectedMonth, year, tasks, calendarEvents, localEvents]);

  const selectedDayData = useMemo(() => ({
    tasks: tasks.filter(t => t.date === selectedDate),
    events: [...calendarEvents, ...localEvents].filter(e => e.date === selectedDate),
  }), [selectedDate, tasks, calendarEvents, localEvents]);

  const todayStr = new Date().toISOString().split('T')[0];
  const monthName = new Date(year, selectedMonth).toLocaleString(
    userConfig.language === 'no' ? 'no-NO' : 'en-US', { month: 'long', year: 'numeric' }
  );

  const completedCount = tasks.filter(t => t.isComplete).length;
  const totalCount = tasks.length;
  const highPriorityPending = tasks.filter(t => t.priority === 'High' && !t.isComplete);

  const weekdays = userConfig.language === 'no' ? WEEKDAYS_NO : WEEKDAYS_EN;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Calendar + day detail */}
        <div className="lg:col-span-2 space-y-6">

          {/* Calendar card */}
          <div className="card p-6">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-slate-800 capitalize">{monthName}</h3>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekdays.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarGrid.map((day, i) => (
                <button
                  key={i}
                  disabled={!day}
                  onClick={() => day && setSelectedDate(day.dateStr)}
                  className={`
                    min-h-[52px] p-1.5 rounded-xl flex flex-col items-center transition-all
                    ${!day ? 'pointer-events-none opacity-0' : ''}
                    ${day?.dateStr === selectedDate ? 'bg-indigo-600 text-white shadow-md' : ''}
                    ${day?.dateStr === todayStr && day?.dateStr !== selectedDate ? 'bg-indigo-50 text-indigo-700 font-bold' : ''}
                    ${day && day.dateStr !== selectedDate && day.dateStr !== todayStr ? 'hover:bg-slate-100 text-slate-700' : ''}
                  `}
                >
                  {day && (
                    <>
                      <span className={`text-xs font-semibold ${day.dateStr === selectedDate ? 'text-white' : ''}`}>
                        {day.day}
                      </span>
                      <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                        {day.tasks.slice(0, 3).map((task: Task, idx: number) => (
                          <div
                            key={idx}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: day.dateStr === selectedDate ? 'white' : PRIORITY_CONFIG[task.priority].dot }}
                          />
                        ))}
                        {day.events.slice(0, 2).map((_: any, idx: number) => (
                          <div
                            key={`e-${idx}`}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: day.dateStr === selectedDate ? 'rgba(255,255,255,0.6)' : '#6366F1' }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Day detail */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="section-title">
                  <CalendarDays className="w-5 h-5 text-indigo-500" />
                  {new Date(selectedDate).toLocaleDateString(
                    userConfig.language === 'no' ? 'no-NO' : 'en-US',
                    { weekday: 'long', day: 'numeric', month: 'long' }
                  )}
                </h3>
                {selectedDate === todayStr && (
                  <span className="badge badge-primary text-xs mt-1">I dag</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowEventForm(!showEventForm); setShowTaskForm(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Hendelse
                </button>
                <button
                  onClick={() => { setShowTaskForm(!showTaskForm); setShowEventForm(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Oppgave
                </button>
              </div>
            </div>

            {/* Event form */}
            {showEventForm && (
              <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl animate-fade-in">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Ny hendelse</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={newEvent.description}
                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Hva skjer?"
                    className="input-field"
                    onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
                  />
                  <select
                    value={newEvent.type}
                    onChange={e => setNewEvent({ ...newEvent, type: e.target.value as any })}
                    className="input-field"
                  >
                    {['Appointment', 'Meeting', 'Social', 'Travel'].map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <select
                    value={newEvent.assignedToId}
                    onChange={e => setNewEvent({ ...newEvent, assignedToId: e.target.value })}
                    className="input-field"
                  >
                    {familyMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <CyberButton onClick={handleAddEvent} variant="primary" className="flex-1 justify-center">
                      <Save className="w-4 h-4" /> Lagre
                    </CyberButton>
                    <CyberButton onClick={() => setShowEventForm(false)} variant="ghost">
                      <X className="w-4 h-4" />
                    </CyberButton>
                  </div>
                </div>
              </div>
            )}

            {/* Task form */}
            {showTaskForm && (
              <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Ny oppgave</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={newTask.description}
                    onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Hva må gjøres?"
                    className="input-field md:col-span-2"
                    onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                  />
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                    className="input-field"
                  >
                    <option value="Low">Lav prioritet</option>
                    <option value="Medium">Middels prioritet</option>
                    <option value="High">Høy prioritet</option>
                  </select>
                  <select
                    value={newTask.assignedToId}
                    onChange={e => setNewTask({ ...newTask, assignedToId: e.target.value })}
                    className="input-field"
                  >
                    {familyMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 md:col-span-2">
                    <CyberButton onClick={handleAddTask} variant="primary" className="flex-1 justify-center">
                      <Save className="w-4 h-4" /> Legg til
                    </CyberButton>
                    <CyberButton onClick={() => setShowTaskForm(false)} variant="ghost">
                      <X className="w-4 h-4" />
                    </CyberButton>
                  </div>
                </div>
              </div>
            )}

            {/* Events for day */}
            {selectedDayData.events.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hendelser</p>
                {selectedDayData.events.map((event: any, i: number) => (
                  <div key={event.id || i} className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-xl group">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: getMemberColor(event.assignedToId) }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{event.description}</p>
                        <p className="text-xs text-slate-400">{getMemberName(event.assignedToId)} · {event.type}</p>
                      </div>
                    </div>
                    {event.id && (
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tasks for day */}
            {selectedDayData.tasks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Oppgaver</p>
                {selectedDayData.tasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all group ${
                      task.isComplete ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={`transition-colors ${task.isComplete ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
                      >
                        {task.isComplete ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                      <div>
                        <p className={`text-sm font-medium ${task.isComplete ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {task.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: getMemberColor(task.assignedToId) }}
                          />
                          <span className="text-xs text-slate-400">{getMemberName(task.assignedToId)}</span>
                          <span className={`badge text-xs ${PRIORITY_CONFIG[task.priority].color}`}>
                            {PRIORITY_CONFIG[task.priority].label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedDayData.tasks.length === 0 && selectedDayData.events.length === 0 && (
              <div className="empty-state py-12">
                <CalendarDays className="w-10 h-10 text-slate-200 mb-3" />
                <p className="font-medium text-slate-400">Ingen oppgaver eller hendelser</p>
                <p className="text-sm text-slate-300 mt-1">Bruk knappene ovenfor for å legge til</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Stats sidebar */}
        <div className="space-y-6">

          {/* Task completion */}
          <div className="card p-5">
            <h3 className="section-title text-base mb-5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Fullføring
            </h3>
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm text-slate-600">{completedCount} av {totalCount} fullført</span>
              <span className="text-2xl font-bold text-indigo-600">
                {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                  background: '#10B981',
                }}
              />
            </div>
          </div>

          {/* High priority tasks */}
          {highPriorityPending.length > 0 && (
            <div className="card p-5 border-red-100 bg-red-50">
              <h3 className="section-title text-base mb-4">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Kritiske oppgaver
              </h3>
              <div className="space-y-2">
                {highPriorityPending.slice(0, 5).map(task => (
                  <div
                    key={task.id}
                    className="p-3 bg-white border border-red-100 rounded-xl cursor-pointer hover:border-red-200 transition-colors"
                    onClick={() => setSelectedDate(task.date)}
                  >
                    <p className="text-sm font-semibold text-slate-800 truncate">{task.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getMemberName(task.assignedToId)} · {new Date(task.date).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Family members */}
          {familyMembers.length > 0 && (
            <div className="card p-5">
              <h3 className="section-title text-base mb-4">
                <User className="w-4 h-4 text-indigo-500" />
                Familiemedlemmer
              </h3>
              <div className="space-y-3">
                {familyMembers.map((member, i) => {
                  const memberTasks = tasks.filter(t => t.assignedToId === member.id);
                  const done = memberTasks.filter(t => t.isComplete).length;
                  return (
                    <div key={member.id} className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                        <p className="text-xs text-slate-400">{done}/{memberTasks.length} oppgaver</p>
                      </div>
                      {memberTasks.length > 0 && (
                        <div className="progress-bar w-16">
                          <div
                            className="progress-fill"
                            style={{ width: `${(done / memberTasks.length) * 100}%`, background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
