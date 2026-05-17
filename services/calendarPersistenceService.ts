import { supabaseFamilyData, isSupabaseConfigured } from '../supabase';
import { CalendarEvent, LocalEvent, Task } from '../types';

function backupKey(userId: string, name: string) { return `familyhub_backup_${name}_${userId}`; }
function readBackup<T>(userId: string, name: string): T[] { try { const data = JSON.parse(localStorage.getItem(backupKey(userId, name)) || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } }
function writeBackup(userId: string, name: string, data: any[]) { try { localStorage.setItem(backupKey(userId, name), JSON.stringify((data || []).slice(0, 5000))); } catch {} }
function cleanId(value: unknown, fallback: string) { return String(value || '').trim() || fallback; }
function todayYear() { return new Date().getFullYear(); }
function normalizeCountry(location?: string) {
  const text = String(location || '').toLowerCase();
  if (text.includes('spain') || text.includes('spania') || text.includes('alicante') || text.includes('pinoso')) return 'ES';
  if (text.includes('norway') || text.includes('norge') || text.includes('oslo')) return 'NO';
  if (text.includes('uk') || text.includes('england') || text.includes('london')) return 'GB';
  if (text.includes('usa') || text.includes('us ') || text.includes('america')) return 'US';
  return 'NO';
}
function familyIdFor(userId: string) { return `user-${userId}`; }

export function mapCalendarEventRow(row: any): CalendarEvent {
  return {
    ...(row.payload || {}),
    id: cleanId(row.id, `event-${Date.now()}`),
    date: row.event_date || row.date || row.payload?.date,
    description: row.description || row.payload?.description || row.title || '',
    title: row.title || row.payload?.title || row.description || '',
    type: row.event_type || row.type || row.payload?.type || 'Appointment',
    assignedToId: row.assigned_to_id || row.payload?.assignedToId,
    assignedToIds: row.assigned_to_ids || row.payload?.assignedToIds || undefined,
    startTime: row.start_time || row.payload?.startTime || '',
    endTime: row.end_time || row.payload?.endTime || '',
  } as any;
}

export function mapTaskRow(row: any): Task {
  return {
    ...(row.payload || {}),
    id: cleanId(row.id, `task-${Date.now()}`),
    date: row.task_date || row.date || row.due_date || row.payload?.date,
    dueDate: row.due_date || row.payload?.dueDate,
    description: row.description || row.payload?.description || row.title || '',
    title: row.title || row.payload?.title || row.description || '',
    assignedToId: row.assigned_to_id || row.payload?.assignedToId,
    assignedToIds: row.assigned_to_ids || row.payload?.assignedToIds || undefined,
    priority: row.priority || row.payload?.priority || 'Medium',
    isComplete: !!(row.is_complete ?? row.payload?.isComplete),
    isDone: !!(row.is_done ?? row.payload?.isDone ?? row.is_complete),
  } as any;
}

export function mapHolidayRow(row: any): LocalEvent {
  return {
    date: row.holiday_date || row.date,
    title: row.local_name || row.name,
    description: row.name || row.local_name || 'Helligdag',
    type: row.type || 'Holiday',
    isLocal: !!row.region_code || !!row.municipality,
  } as LocalEvent;
}

function eventRow(userId: string, event: any) {
  const participants = event.assignedToIds || (event.assignedToId ? [event.assignedToId] : []);
  return {
    id: cleanId(event.id, `event-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    event_date: event.date || new Date().toISOString().slice(0, 10),
    title: event.title || event.description || '',
    description: event.description || event.title || '',
    event_type: event.type || 'Appointment',
    assigned_to_id: event.assignedToId || participants[0] || null,
    assigned_to_ids: participants,
    start_time: event.startTime || null,
    end_time: event.endTime || null,
    payload: event,
    updated_at: new Date().toISOString(),
  };
}
function taskRow(userId: string, task: any) {
  const participants = task.assignedToIds || (task.assignedToId ? [task.assignedToId] : []);
  return {
    id: cleanId(task.id, `task-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    user_id: userId,
    task_date: task.date || task.dueDate || new Date().toISOString().slice(0, 10),
    title: task.title || task.description || '',
    description: task.description || task.title || '',
    priority: task.priority || 'Medium',
    assigned_to_id: task.assignedToId || participants[0] || null,
    assigned_to_ids: participants,
    is_complete: !!(task.isComplete || task.isDone),
    payload: task,
    updated_at: new Date().toISOString(),
  };
}

export async function loadCalendarPersistentData(userId: string) {
  const fallback = {
    calendarEvents: readBackup<CalendarEvent>(userId, 'calendar_events'),
    tasks: readBackup<Task>(userId, 'tasks'),
    localEvents: readBackup<LocalEvent>(userId, 'local_events'),
  };
  if (!isSupabaseConfigured() || !userId) return fallback;
  try {
    const [events, tasks, holidays] = await Promise.all([
      supabaseFamilyData.from('calendar_events').select('*').eq('user_id', userId).order('event_date', { ascending: true }),
      supabaseFamilyData.from('tasks').select('*').eq('user_id', userId).order('task_date', { ascending: true }),
      supabaseFamilyData.from('family_holidays').select('*').eq('family_id', familyIdFor(userId)).order('holiday_date', { ascending: true }),
    ]);
    if (events.error) console.warn('[calendarPersistence] calendar_events load failed', events.error);
    if (tasks.error) console.warn('[calendarPersistence] tasks load failed', tasks.error);
    if (holidays.error) console.warn('[calendarPersistence] family_holidays load failed', holidays.error);
    const calendarEvents = !events.error ? (events.data || []).map(mapCalendarEventRow) : fallback.calendarEvents;
    const taskRows = !tasks.error ? (tasks.data || []).map(mapTaskRow) : fallback.tasks;
    const localEvents = !holidays.error ? (holidays.data || []).map(mapHolidayRow) : fallback.localEvents;
    writeBackup(userId, 'calendar_events', calendarEvents);
    writeBackup(userId, 'tasks', taskRows);
    writeBackup(userId, 'local_events', localEvents);
    return { calendarEvents, tasks: taskRows, localEvents };
  } catch (err) {
    console.warn('[calendarPersistence] load failed', err);
    return fallback;
  }
}

export async function syncCalendarEvents(userId: string, events: CalendarEvent[]) {
  if (!userId) return;
  writeBackup(userId, 'calendar_events', events as any[]);
  if (!isSupabaseConfigured()) return;
  const rows = (events as any[]).map((event) => eventRow(userId, event));
  if (rows.length === 0) return;
  const { error } = await supabaseFamilyData.from('calendar_events').upsert(rows, { onConflict: 'id' });
  if (error) console.error('[calendarPersistence] calendar event sync failed', error);
}

export async function syncTasks(userId: string, tasks: Task[]) {
  if (!userId) return;
  writeBackup(userId, 'tasks', tasks as any[]);
  if (!isSupabaseConfigured()) return;
  const rows = (tasks as any[]).map((task) => taskRow(userId, task));
  if (rows.length === 0) return;
  const { error } = await supabaseFamilyData.from('tasks').upsert(rows, { onConflict: 'id' });
  if (error) console.error('[calendarPersistence] task sync failed', error);
}

export async function deleteCalendarEventFromSupabase(userId: string, id: string) {
  if (!userId || !id) return;
  writeBackup(userId, 'calendar_events', readBackup<CalendarEvent>(userId, 'calendar_events').filter((event: any) => event.id !== id));
  if (!isSupabaseConfigured()) return;
  const { error } = await supabaseFamilyData.from('calendar_events').delete().eq('user_id', userId).eq('id', id);
  if (error) console.error('[calendarPersistence] calendar event delete failed', error);
}

export async function deleteTaskFromSupabase(userId: string, id: string) {
  if (!userId || !id) return;
  writeBackup(userId, 'tasks', readBackup<Task>(userId, 'tasks').filter((task: any) => task.id !== id));
  if (!isSupabaseConfigured()) return;
  const { error } = await supabaseFamilyData.from('tasks').delete().eq('user_id', userId).eq('id', id);
  if (error) console.error('[calendarPersistence] task delete failed', error);
}

export async function ensureOfficialHolidays(userId: string, location?: string) {
  if (!userId) return readBackup<LocalEvent>(userId, 'local_events');
  const countryCode = normalizeCountry(location);
  const year = todayYear();
  const familyId = familyIdFor(userId);
  if (!isSupabaseConfigured()) return readBackup<LocalEvent>(userId, 'local_events');
  try {
    const existing = await supabaseFamilyData.from('family_holidays').select('*').eq('family_id', familyId).gte('holiday_date', `${year}-01-01`).lte('holiday_date', `${year}-12-31`);
    if (!existing.error && (existing.data || []).length > 0) {
      const rows = (existing.data || []).map(mapHolidayRow);
      writeBackup(userId, 'local_events', rows);
      return rows;
    }
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
    if (!res.ok) throw new Error(`holiday fetch ${res.status}`);
    const data = await res.json();
    const rows = (Array.isArray(data) ? data : []).map((h: any) => ({
      family_id: familyId,
      holiday_date: h.date,
      name: h.name || h.localName || 'Holiday',
      local_name: h.localName || h.name || 'Helligdag',
      type: (h.types || []).includes('Bank') ? 'Bank Holiday' : 'Holiday',
      country_code: countryCode,
      region_code: (h.counties || [])[0] || null,
      source: 'Nager.Date',
      is_enabled: true,
    }));
    if (rows.length > 0) await supabaseFamilyData.from('family_holidays').upsert(rows, { onConflict: 'family_id,holiday_date,name,type' });
    const mapped = rows.map(mapHolidayRow);
    writeBackup(userId, 'local_events', mapped);
    return mapped;
  } catch (err) {
    console.warn('[calendarPersistence] holiday sync failed', err);
    return readBackup<LocalEvent>(userId, 'local_events');
  }
}
