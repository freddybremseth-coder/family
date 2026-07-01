// Genererer en iCal-fil (.ics) fra CalendarEvent + Task + LocalEvent
// slik at familien kan abonnere på FamilieHub-kalenderen i Apple/Google.

import { CalendarEvent, Task, LocalEvent } from '../types';

function escapeIcal(text: string): string {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatDate(dateStr: string, time?: string): string {
  // YYYY-MM-DD → YYYYMMDD, med tid HHmm → YYYYMMDDTHHmm00
  const clean = dateStr.replace(/-/g, '');
  if (time) {
    const t = time.replace(':', '');
    return `${clean}T${t}00`;
  }
  return clean;
}

interface IcalOptions {
  familyName: string;
  events: CalendarEvent[];
  tasks?: Task[];
  localEvents?: LocalEvent[];
}

export function generateIcal(opts: IcalOptions): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push(`PRODID:-//FamilieHub//${opts.familyName}//NO`);
  lines.push(`X-WR-CALNAME:${escapeIcal(opts.familyName)} — FamilieHub`);
  lines.push('X-WR-TIMEZONE:Europe/Oslo');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  for (const ev of opts.events) {
    if (!ev.date) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:event-${ev.id}@familyhub`);
    lines.push(`DTSTAMP:${now}`);
    const start = formatDate(ev.date, (ev as any).time);
    if ((ev as any).time) {
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${start}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${start}`);
    }
    lines.push(`SUMMARY:${escapeIcal(ev.description || ev.title || 'Familieaktivitet')}`);
    if ((ev as any).notes) lines.push(`DESCRIPTION:${escapeIcal((ev as any).notes)}`);
    lines.push(`CATEGORIES:${escapeIcal(ev.type || 'Family')}`);
    lines.push('END:VEVENT');
  }

  for (const task of opts.tasks || []) {
    if (task.isComplete || !(task as any).date) continue;
    lines.push('BEGIN:VTODO');
    lines.push(`UID:task-${task.id}@familyhub`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DUE;VALUE=DATE:${formatDate((task as any).date)}`);
    lines.push(`SUMMARY:${escapeIcal(task.description || task.title || 'Oppgave')}`);
    lines.push(`PRIORITY:${(task as any).priority === 'high' ? '1' : (task as any).priority === 'low' ? '9' : '5'}`);
    lines.push('END:VTODO');
  }

  for (const holiday of opts.localEvents || []) {
    if (!holiday.date) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:holiday-${holiday.date}-${escapeIcal(holiday.title || '').slice(0, 20)}@familyhub`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${formatDate(holiday.date)}`);
    lines.push(`SUMMARY:${escapeIcal(holiday.title || 'Helligdag')}`);
    if (holiday.description) lines.push(`DESCRIPTION:${escapeIcal(holiday.description)}`);
    lines.push(`CATEGORIES:${escapeIcal(holiday.type || 'Holiday')}`);
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcal(filename: string, ical: string): void {
  const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
