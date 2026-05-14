import { supabase, isSupabaseConfigured } from '../supabase';

export type AiKeyName = 'user_gemini_api_key' | 'user_openai_api_key' | 'user_claude_api_key';

export interface AiSettings {
  user_gemini_api_key: string;
  user_openai_api_key: string;
  user_claude_api_key: string;
}

const emptySettings: AiSettings = {
  user_gemini_api_key: '',
  user_openai_api_key: '',
  user_claude_api_key: '',
};

function clean(value: unknown) {
  return String(value || '').trim();
}

export function getLocalAiSettings(): AiSettings {
  return {
    user_gemini_api_key: clean(localStorage.getItem('user_gemini_api_key')),
    user_openai_api_key: clean(localStorage.getItem('user_openai_api_key')),
    user_claude_api_key: clean(localStorage.getItem('user_claude_api_key')),
  };
}

export function saveLocalAiSettings(settings: Partial<AiSettings>) {
  (Object.keys(emptySettings) as AiKeyName[]).forEach((key) => {
    if (!(key in settings)) return;
    const value = clean(settings[key]);
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  });
  window.dispatchEvent(new CustomEvent('familyhub-ai-settings-updated'));
}

export async function loadSyncedAiSettings(): Promise<AiSettings> {
  const local = getLocalAiSettings();
  if (!isSupabaseConfigured()) return local;

  try {
    const { data, error } = await supabase.functions.invoke('ai-settings', { method: 'GET' });
    if (error) {
      console.warn('[aiSettingsService] could not load synced AI settings', error);
      return local;
    }
    const synced: AiSettings = {
      user_gemini_api_key: clean(data?.gemini),
      user_openai_api_key: clean(data?.openai),
      user_claude_api_key: clean(data?.claude),
    };
    const merged: AiSettings = {
      user_gemini_api_key: synced.user_gemini_api_key || local.user_gemini_api_key,
      user_openai_api_key: synced.user_openai_api_key || local.user_openai_api_key,
      user_claude_api_key: synced.user_claude_api_key || local.user_claude_api_key,
    };
    saveLocalAiSettings(merged);
    return merged;
  } catch (err) {
    console.warn('[aiSettingsService] synced AI settings load failed', err);
    return local;
  }
}

export async function saveSyncedAiSettings(settings: AiSettings) {
  const cleaned: AiSettings = {
    user_gemini_api_key: clean(settings.user_gemini_api_key),
    user_openai_api_key: clean(settings.user_openai_api_key),
    user_claude_api_key: clean(settings.user_claude_api_key),
  };
  saveLocalAiSettings(cleaned);

  if (!isSupabaseConfigured()) return { synced: false, reason: 'supabase_missing' };

  const { error } = await supabase.functions.invoke('ai-settings', {
    method: 'POST',
    body: {
      gemini: cleaned.user_gemini_api_key,
      openai: cleaned.user_openai_api_key,
      claude: cleaned.user_claude_api_key,
    },
  });

  if (error) {
    console.warn('[aiSettingsService] could not sync AI settings', error);
    throw error;
  }

  return { synced: true };
}
