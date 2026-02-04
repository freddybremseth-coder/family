
import React, { useState, useMemo } from 'react';
import { FamilyMember, CalendarEvent, Task, LocalEvent, UserConfig } from '../types';
import { translations } from '../translations';
import { 
  CalendarDays, Calendar as CalendarIcon, MapPin, ChevronRight, Activity, 
  Clock, ShieldAlert, Zap, Plus, Trash2, CheckCircle, Circle, User, 
  AlertTriangle, Filter, X, Save
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

export const FamilyCalendar: React.FC<Props> = ({ 
  familyMembers, 
  calendarEvents,
  setCalendarEvents,
  tasks,
  setTasks,
  userConfig, 
  localEvents, 
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const t = translations[userConfig.language];

  const [newTask, setNewTask] = useState<Partial<Task>>({
    description: '',
    priority: 'Medium',
    assignedToId: familyMembers[0]?.id || '',
    isComplete: false
  });

  const handleAddTask = () => {
    if (!newTask.description) return;
    const task: Task = {
      id: `task-${Date.now()}`,
      date: selectedDate,
      description: newTask.description,
      assignedToId: newTask.assignedToId || '',
      priority: newTask.priority as 'Low' | 'Medium' | 'High',
      isComplete: false
    };
    setTasks(prev => [...prev, task]);
    setNewTask({ ...newTask, description: '' });
    setShowTaskForm(false);
  };

  const toggleTaskComplete = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isComplete: !t.isComplete } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const calendarGrid = useMemo(() => {
    const year = new Date().getFullYear();
    const firstDayOfMonth = new Date(year, selectedMonth, 1).getDay();
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const days = [];
    const padding = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    
    for (let i = 0; i < padding; i++) days.push(null);
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayTasks = tasks.filter(t => t.date === dateStr);
      const dayEvents = [...calendarEvents, ...localEvents].filter(e => e.date === dateStr);
      days.push({ day: i, dateStr, tasks: dayTasks, events: dayEvents });
    }
    return days;
  }, [selectedMonth, tasks, calendarEvents, localEvents]);

  const selectedDayData = useMemo(() => {
    return {
      tasks: tasks.filter(t => t.date === selectedDate),
      events: [...calendarEvents, ...localEvents].filter(e => e.date === selectedDate)
    };
  }, [selectedDate, tasks, calendarEvents, localEvents]);

  const priorityColors = {
    Low: 'bg-cyan-500',
    Medium: 'bg-yellow-500',
    High: 'bg-rose-500'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* KALENDER-HOVEDDEL */}
        <div className="lg:col-span-8 space-y-12">
          <div className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                <CalendarIcon className="text-cyan-400 w-5 h-5" /> {t.familyplan}
               </h3>
               <div className="flex gap-4">
                  <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(Number(e.target.value))} 
                    className="bg-black border border-white/10 text-cyan-400 text-[10px] font-black uppercase px-4 py-2 outline-none focus:border-cyan-500 transition-all"
                  >
                    {Array.from({length: 12}).map((_, i) => (
                      <option key={i} value={i}>{new Date(0, i).toLocaleString(userConfig.language === 'no' ? 'no-NO' : 'en-US', {month: 'long'})}</option>
                    ))}
                  </select>
               </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map(d => (
                <div key={d} className="text-center text-[9px] font-black text-slate-600 uppercase mb-4 py-2 border-b border-white/5">{d}</div>
              ))}
              {calendarGrid.map((day, i) => (
                <div 
                  key={i} 
                  onClick={() => day && setSelectedDate(day.dateStr)}
                  className={`min-h-[80px] border border-white/5 p-2 flex flex-col relative group cursor-pointer transition-all ${
                    day?.dateStr === selectedDate ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-black/20 hover:bg-white/5'
                  } ${!day ? 'opacity-0 pointer-events-none' : ''}`}
                >
                  {day && (
                    <>
                      <span className={`text-[10px] font-black ${day.dateStr === selectedDate ? 'text-cyan-400' : 'text-slate-700'}`}>
                        {day.day}
                      </span>
                      
                      {/* OPPGAVE-INDIKATORER I KALENDEREN */}
                      <div className="mt-auto flex flex-wrap gap-1">
                        {day.tasks.map((task, idx) => (
                          <div 
                            key={idx} 
                            className={`w-1.5 h-1.5 rounded-full ${priorityColors[task.priority]} ${task.isComplete ? 'opacity-20' : 'shadow-[0_0_5px_currentColor]'}`} 
                            title={task.description}
                          />
                        ))}
                        {day.events.length > 0 && (
                          <div className="w-1.5 h-1.5 bg-white opacity-40 rounded-full" />
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* DAGSVISNING / OPPGAVELISTE */}
          <div className="glass-panel p-8 border-l-4 border-l-yellow-500 bg-yellow-500/5">
             <div className="flex justify-between items-center mb-10">
                <div>
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                      Plan for {new Date(selectedDate).toLocaleDateString(userConfig.language === 'no' ? 'no-NO' : 'en-US', { day: 'numeric', month: 'long' })}
                   </h3>
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Sentrale husholdningsoppgaver</p>
                </div>
                <button 
                  onClick={() => setShowTaskForm(!showTaskForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400 transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                >
                   {showTaskForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showTaskForm ? 'Lukk' : 'Ny Oppgave'}
                </button>
             </div>

             {showTaskForm && (
                <div className="mb-10 p-6 bg-black/40 border border-yellow-500/20 animate-in slide-in-from-top-4">
                   <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                      <div className="md:col-span-5 space-y-2">
                         <label className="text-[9px] uppercase font-black text-slate-500">Oppgavebeskrivelse</label>
                         <input 
                            value={newTask.description}
                            onChange={e => setNewTask({...newTask, description: e.target.value})}
                            className="w-full bg-black border border-white/10 p-3 text-white text-xs outline-none focus:border-yellow-500 transition-all"
                            placeholder="Hva må gjøres?"
                         />
                      </div>
                      <div className="md:col-span-3 space-y-2">
                         <label className="text-[9px] uppercase font-black text-slate-500">Prioritet</label>
                         <select 
                            value={newTask.priority}
                            onChange={e => setNewTask({...newTask, priority: e.target.value as any})}
                            className="w-full bg-black border border-white/10 p-3 text-white text-[10px] font-black uppercase outline-none focus:border-yellow-500"
                         >
                            <option value="Low">Lav</option>
                            <option value="Medium">Middels</option>
                            <option value="High">Høy</option>
                         </select>
                      </div>
                      <div className="md:col-span-3 space-y-2">
                         <label className="text-[9px] uppercase font-black text-slate-500">Ansvarlig</label>
                         <select 
                            value={newTask.assignedToId}
                            onChange={e => setNewTask({...newTask, assignedToId: e.target.value})}
                            className="w-full bg-black border border-white/10 p-3 text-white text-[10px] font-black uppercase outline-none focus:border-yellow-500"
                         >
                            {familyMembers.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                         </select>
                      </div>
                      <div className="md:col-span-1">
                         <button onClick={handleAddTask} className="w-full aspect-square bg-yellow-500 flex items-center justify-center hover:bg-yellow-400 transition-all">
                            <Save className="w-5 h-5 text-black" />
                         </button>
                      </div>
                   </div>
                </div>
             )}

             <div className="space-y-4">
                {selectedDayData.tasks.length === 0 && (
                   <div className="py-12 text-center border border-dashed border-white/5 opacity-30">
                      <p className="text-[10px] font-black uppercase tracking-widest">Ingen oppgaver for denne dagen</p>
                   </div>
                )}
                {selectedDayData.tasks.map(task => {
                   const member = familyMembers.find(m => m.id === task.assignedToId);
                   return (
                      <div 
                        key={task.id} 
                        className={`p-4 border transition-all flex items-center justify-between group ${
                          task.isComplete ? 'bg-black/40 border-white/5 opacity-50' : 'bg-white/5 border-white/10 hover:border-yellow-500/30'
                        }`}
                      >
                         <div className="flex items-center gap-6">
                            <button 
                              onClick={() => toggleTaskComplete(task.id)}
                              className={`transition-all ${task.isComplete ? 'text-emerald-500' : 'text-slate-600 hover:text-yellow-500'}`}
                            >
                               {task.isComplete ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                            </button>
                            <div>
                               <div className="flex items-center gap-3">
                                  <h4 className={`text-sm font-black uppercase tracking-tight ${task.isComplete ? 'line-through' : 'text-white'}`}>
                                     {task.description}
                                  </h4>
                                  <span className={`px-2 py-0.5 text-[8px] font-black uppercase ${priorityColors[task.priority]} text-black`}>
                                     {task.priority}
                                  </span>
                               </div>
                               <div className="flex items-center gap-2 mt-1">
                                  <User className="w-3 h-3 text-slate-500" />
                                  <span className="text-[10px] font-mono text-slate-500 uppercase">{member?.name || 'Ufordelt'}</span>
                               </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-500 hover:text-rose-500">
                               <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                      </div>
                   );
                })}
             </div>
          </div>
        </div>

        {/* SIDEBAR - AKTIVITET OG STATS */}
        <div className="lg:col-span-4 space-y-8">
           <div className="glass-panel p-6 border-l-4 border-l-magenta-500 bg-magenta-500/5">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-magenta-400" /> Oppgaveoversikt
              </h3>
              <div className="space-y-6">
                 <div>
                    <p className="text-[9px] text-slate-500 uppercase font-black mb-3 tracking-widest">Kritiske Oppgaver (High)</p>
                    <div className="space-y-3">
                       {tasks.filter(t => t.priority === 'High' && !t.isComplete).slice(0, 3).map(task => (
                          <div key={task.id} className="p-3 bg-rose-500/10 border border-rose-500/20 flex justify-between items-center">
                             <span className="text-[10px] font-bold text-white uppercase">{task.description}</span>
                             <span className="text-[8px] font-mono text-rose-500">{task.date.split('-').slice(1).join('/')}</span>
                          </div>
                       ))}
                    </div>
                 </div>
                 
                 <div className="pt-6 border-t border-white/5">
                    <p className="text-[9px] text-slate-500 uppercase font-black mb-3 tracking-widest">Fullføringsgrad</p>
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-[10px] text-white font-mono">
                          {tasks.filter(t => t.isComplete).length} / {tasks.length}
                       </span>
                       <span className="text-sm font-black text-magenta-400">
                          {tasks.length > 0 ? Math.round((tasks.filter(t => t.isComplete).length / tasks.length) * 100) : 0}%
                       </span>
                    </div>
                    <div className="w-full h-1 bg-black overflow-hidden">
                       <div 
                         className="h-full bg-magenta-500 shadow-[0_0_10px_#ff00ff] transition-all duration-1000"
                         style={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.isComplete).length / tasks.length) * 100 : 0}%` }}
                       />
                    </div>
                 </div>
              </div>
           </div>

           <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" /> System Info
              </h3>
              <p className="text-[10px] text-slate-400 italic leading-relaxed">
                Trykk på en hvilken som helst dag i kalenderen for å fokusere på dens spesifikke oppgaver og hendelser. Oppgaver markert med farger i rutenettet gir en rask visuell status på dagens arbeidsmengde.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};
