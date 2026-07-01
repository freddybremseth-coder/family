import React, { useState } from 'react';
import { AlertTriangle, Award, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { analyzeWeeklyTasks } from '../services/geminiService';
import { FamilyMember, Task } from '../types';

interface Props {
  tasks: Task[];
  familyMembers: FamilyMember[];
  onAddTask?: (task: { description: string; assignedTo?: string; priority?: string; date?: string }) => void;
}

interface AnalysisResult {
  summary?: string;
  coverage?: string;
  missingCategories?: string[];
  suggestedTasks?: Array<{ description: string; suggestedAssignee?: string; priority?: string; reason?: string }>;
  balanceWarning?: string;
  celebration?: string;
  actionItems?: string[];
}

export const AITaskChief: React.FC<Props> = ({ tasks, familyMembers, onAddTask }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeWeeklyTasks(
        tasks.map(t => ({
          description: t.title || (t as any).description || '',
          date: t.dueDate || (t as any).date,
          assignedTo: familyMembers.find(m => m.id === t.assignedTo)?.name,
          isComplete: t.isDone || (t as any).isComplete,
          priority: (t as any).priority,
          recurrence: t.recurrence,
        })),
        familyMembers,
      );
      setAnalysis(result);
    } catch (e: any) {
      setError(e?.message?.includes('API') ? 'AI-nøkkel mangler i Innstillinger → AI.' : (e?.message || 'AI-analyse feilet.'));
    } finally { setLoading(false); }
  };

  const handleAddSuggested = (i: number, task: NonNullable<AnalysisResult['suggestedTasks']>[number]) => {
    if (!onAddTask) return;
    const assignee = familyMembers.find(m => m.name.toLowerCase() === (task.suggestedAssignee || '').toLowerCase());
    onAddTask({ description: task.description, assignedTo: assignee?.id, priority: task.priority });
    setAdded(new Set([...added, i]));
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); if (!analysis) analyze(); }}
        className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
      >
        <Sparkles className="h-4 w-4" /> AI-oppgavesjef
      </button>

      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Sparkles className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">AI-oppgavesjef</h2>
                  <p className="text-sm text-slate-500">Evaluerer ukens oppgaver og foreslår omfordeling</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={analyze} disabled={loading} className="btn-secondary text-xs">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Analyser
                </button>
                <button onClick={() => setOpen(false)} className="rounded-xl p-1.5 hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loading ? (
                <p className="text-center text-slate-500 py-10">Analyserer ukens oppgaver...</p>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
              ) : !analysis ? (
                <p className="text-center text-slate-500 py-10">Klikk «Analyser» for å starte.</p>
              ) : (
                <>
                  {/* Oppsummering */}
                  {analysis.summary && (
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                      <p className="text-[10px] uppercase font-black text-slate-600 tracking-wide mb-1">Ukens status</p>
                      <p className="text-sm text-slate-900">{analysis.summary}</p>
                    </div>
                  )}

                  {/* Ros */}
                  {analysis.celebration && (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                      <p className="text-[10px] uppercase font-black text-emerald-800 tracking-wide mb-1 flex items-center gap-1"><Award className="h-3 w-3" /> Godt jobbet</p>
                      <p className="text-sm text-emerald-900">{analysis.celebration}</p>
                    </div>
                  )}

                  {/* Skjevfordeling */}
                  {analysis.balanceWarning && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                      <p className="text-[10px] uppercase font-black text-amber-800 tracking-wide mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Skjevfordeling</p>
                      <p className="text-sm text-amber-900">{analysis.balanceWarning}</p>
                    </div>
                  )}

                  {/* Manglende kategorier */}
                  {analysis.missingCategories && analysis.missingCategories.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-600 tracking-wide mb-2">Mangler helt</p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.missingCategories.map((cat, i) => (
                          <span key={i} className="inline-flex rounded-full bg-rose-100 text-rose-800 px-3 py-1 text-xs font-bold">{cat}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Foreslåtte oppgaver */}
                  {analysis.suggestedTasks && analysis.suggestedTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-600 tracking-wide mb-2">Foreslåtte oppgaver</p>
                      <div className="space-y-2">
                        {analysis.suggestedTasks.map((t, i) => {
                          const isAdded = added.has(i);
                          return (
                            <div key={i} className={`rounded-2xl border p-3 ${isAdded ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-slate-900">{t.description}</p>
                                  {t.reason && <p className="text-xs text-slate-600 mt-0.5">{t.reason}</p>}
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {t.suggestedAssignee && <span className="inline-flex rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-bold">→ {t.suggestedAssignee}</span>}
                                    {t.priority && <span className="inline-flex rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold">{t.priority}</span>}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleAddSuggested(i, t)}
                                  disabled={isAdded}
                                  className={`shrink-0 rounded-xl p-2 ${isAdded ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Handlingspunkter */}
                  {analysis.actionItems && analysis.actionItems.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-600 tracking-wide mb-2">Anbefalinger denne uken</p>
                      <ul className="space-y-1.5">
                        {analysis.actionItems.map((item, i) => (
                          <li key={i} className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-800">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
