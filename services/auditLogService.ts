// Enkel audit-log-service. Kall logAction() for sensitive operasjoner.
import { supabase, isSupabaseConfigured } from '../supabase';

export interface AuditEntry {
  id: string;
  actorUserId?: string;
  actorEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export async function logAction(input: {
  action: string;
  actorUserId: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured() || !input.actorUserId) return;
  try {
    const { error } = await supabase.from('audit_log').insert({
      actor_user_id: input.actorUserId,
      actor_email: input.actorEmail || null,
      action: input.action,
      target_type: input.targetType || null,
      target_id: input.targetId || null,
      details: input.details || null,
      user_agent: navigator.userAgent.slice(0, 500),
    });
    if (error) console.warn('[audit] insert failed', error.message);
  } catch (e) {
    console.warn('[audit] insert crashed', e);
  }
}

export async function fetchRecentAudit(limit = 100): Promise<AuditEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) { console.warn('[audit] fetch failed', error); return []; }
  return data.map((r: any) => ({
    id: r.id,
    actorUserId: r.actor_user_id,
    actorEmail: r.actor_email,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    details: r.details,
    createdAt: r.created_at,
  }));
}
