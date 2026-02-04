
import React, { useState, useMemo } from 'react';
import { FamilyMember, CalendarEvent, Task, LocalEvent, UserConfig, Currency, Language } from '../types';
import { translations } from '../translations';
import { 
  CalendarDays, Calendar as CalendarIcon, MapPin, ChevronRight, Activity, Clock, ShieldAlert, Zap, Search
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

export const FamilyCalendar: React.FC<Props> = ({ 
  familyMembers, 
  calendarEvents,
  setCalendarEvents,
  tasks,
  setTasks,
  userConfig, 
  localEvents, 
  setLocalEvents 
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const t = translations[userConfig.language];

  const unifiedTimeline = useMemo(() => {
    const combined = [
      ...calendarEvents.map(e => ({ ...e, source: 'family' as const })),
      ...localEvents.map(e => ({ ...e, source: 'local' as const, id: `local-${e.date}-${e.title}` })),
      ...tasks.filter(t => t.priority === 'High' && !t.isComplete).map(t => ({ 
        id: t.id, 
        date: t.date, 
        description: `GJØREMÅL: ${t.description}`, 
        source: 'task' as const,
        type: 'Social' as const,
        assignedToId: t.assignedToId
      }))
    ];
    return combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [calendarEvents, localEvents, tasks]);

  const calendarGrid = useMemo(() => {
    const year = new Date().getFullYear();
    const firstDayOfMonth = new Date(year, selectedMonth, 1).getDay();
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const days = [];
    const padding = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    for (let i = 0; i < padding; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const eventsOnDay = unifiedTimeline.filter(e => e.date === dateStr);
      days.push({ day: i, events: eventsOnDay, dateStr });
    }
    return days;
  }, [selectedMonth, unifiedTimeline]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-12">
          <div className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                <CalendarIcon className="text-cyan-400 w-5 h-5" /> {t.familyplan}
               </h3>
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-black border border-white/10 text-cyan-400 text-[10px] font-black uppercase px-4 py-2 outline-none">
                {Array.from({length: 12}).map((_, i) => (
                  <option key={i} value={i}>{new Date(0, i).toLocaleString(userConfig.language === 'no' ? 'no-NO' : 'en-US', {month: 'long'})}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map(d => (
                <div key={d} className="text-center text-[9px] font-black text-slate-600 uppercase mb-4">{d}</div>
              ))}
              {calendarGrid.map((day, i) => (
                <div key={i} className={`aspect-square border border-white/5 flex flex-col items-center justify-center relative group cursor-pointer transition-all ${
                  day?.events.length ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-black/20 hover:bg-white/5'
                }`}>
                  {day && <span className={`text-xs font-black ${day.events.length ? 'text-cyan-400' : 'text-slate-700'}`}>{day.day}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="glass-panel p-6 border-l-4 border-l-magenta-500 bg-magenta-500/5">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-magenta-400" /> Kommende Hendelser
              </h3>
              <div className="space-y-4">
                {unifiedTimeline.filter(e => new Date(e.date) >= new Date()).slice(0, 5).map((e, i) => (
                  <div key={i} className="p-3 bg-black/40 border border-white/5 flex items-start gap-4">
                     <div className="text-[9px] font-mono text-magenta-500 shrink-0">{e.date.split('-').slice(1).join('/')}</div>
                     <div>
                        <p className="text-xs font-bold text-white uppercase">{e.title || e.description}</p>
                        <p className="text-[8px] text-slate-500 uppercase mt-0.5">{e.source}</p>
                     </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
