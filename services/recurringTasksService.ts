// Genererer forekomster av gjentakende oppgaver.
// Kjøres ved app-oppstart og etter hver oppgave-fullførelse.

import { Task } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function nextDate(from: Date, recurrence: NonNullable<Task['recurrence']>, dayHint?: number): Date {
  const next = new Date(from);
  switch (recurrence) {
    case 'daily': return addDays(next, 1);
    case 'weekly': {
      const target = typeof dayHint === 'number' ? dayHint : next.getDay();
      const diff = ((target - next.getDay() + 7) % 7) || 7;
      return addDays(next, diff);
    }
    case 'biweekly': return addDays(next, 14);
    case 'monthly': {
      const day = typeof dayHint === 'number' ? dayHint : next.getDate();
      const target = new Date(next.getFullYear(), next.getMonth() + 1, Math.min(day, 28));
      return target;
    }
    case 'yearly': {
      const target = new Date(next.getFullYear() + 1, next.getMonth(), next.getDate());
      return target;
    }
  }
}

/**
 * Sjekker alle oppgaver med recurrence og produserer ny forekomst hvis siste
 * er fullført ELLER hvis dueDate er passert.
 * Returnerer nye tasks som skal legges til.
 */
export function generateNextOccurrences(tasks: Task[]): Task[] {
  const newTasks: Task[] = [];
  const parentIds = new Set(tasks.filter(t => t.recurrence).map(t => t.id));

  // For hver "parent" recurrence-task: sjekk om det finnes en åpen instans
  for (const parent of tasks.filter(t => t.recurrence && !t.recurrenceParentId)) {
    // Finn siste generert instans
    const instances = tasks.filter(t => t.recurrenceParentId === parent.id);
    const hasOpenInstance = instances.some(i => !i.isDone && i.dueDate && new Date(i.dueDate).getTime() >= Date.now() - DAY_MS);
    if (hasOpenInstance) continue;

    // Beregn neste dueDate
    const anchor = instances.length > 0
      ? new Date(instances[instances.length - 1].dueDate || Date.now())
      : new Date(parent.dueDate || Date.now());
    const next = nextDate(anchor, parent.recurrence!, parent.recurrenceDay);

    // Ikke generer hvis parent.nextGenerationDate = fremtidig
    if (parent.nextGenerationDate && new Date(parent.nextGenerationDate).getTime() > Date.now()) continue;

    newTasks.push({
      id: `${parent.id}-${next.toISOString().slice(0, 10)}`,
      title: parent.title,
      dueDate: next.toISOString().slice(0, 10),
      isDone: false,
      assignedTo: parent.assignedTo,
      recurrenceParentId: parent.id,
    });
  }

  return newTasks;
}

export function describeRecurrence(rec?: Task['recurrence']): string {
  switch (rec) {
    case 'daily': return 'Hver dag';
    case 'weekly': return 'Ukentlig';
    case 'biweekly': return 'Annenhver uke';
    case 'monthly': return 'Månedlig';
    case 'yearly': return 'Årlig';
    default: return '';
  }
}
