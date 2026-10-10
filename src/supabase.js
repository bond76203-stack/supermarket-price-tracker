import { createClient } from '@supabase/supabase-js';

// LocalStorage Keys for persistent custom user settings (if env variables are not present or overridden via UI)
const STORAGE_URL_KEY = 'supermarket_app_supabase_url';
const STORAGE_ANON_KEY = 'supermarket_app_supabase_anon_key';
const STORAGE_DEMO_MODE_KEY = 'supermarket_app_demo_mode';

let supabaseInstance = null;
let currentConfig = {
  url: '',
  anonKey: '',
  isDemo: false
};

/**
 * Get configured Supabase credentials from Vite env or LocalStorage fallback
 */
export function getSupabaseCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = localStorage.getItem(STORAGE_URL_KEY) || '';
  const storedKey = localStorage.getItem(STORAGE_ANON_KEY) || '';
  const storedDemo = localStorage.getItem(STORAGE_DEMO_MODE_KEY) === 'true';

  const url = storedUrl || envUrl;
  const anonKey = storedKey || envAnonKey;

  return {
    url: url.trim(),
    anonKey: anonKey.trim(),
    isDemo: storedDemo || (!url || !anonKey || url.includes('your-project-ref'))
  };
}

/**
 * Save custom Supabase credentials to localStorage
 */
export function saveSupabaseCredentials(url, anonKey, enableDemo = false) {
  if (url) localStorage.setItem(STORAGE_URL_KEY, url.trim());
  else localStorage.removeItem(STORAGE_URL_KEY);

  if (anonKey) localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
  else localStorage.removeItem(STORAGE_ANON_KEY);

  localStorage.setItem(STORAGE_DEMO_MODE_KEY, enableDemo ? 'true' : 'false');

  // Re-initialize
  supabaseInstance = null;
  return getSupabaseClient();
}

/**
 * Get initialized Supabase client instance (or null in Demo mode)
 */
export function getSupabaseClient() {
  const config = getSupabaseCredentials();
  currentConfig = config;

  if (config.isDemo) {
    return null; // Demo Mode uses localStorage mock DB
  }

  if (!supabaseInstance && config.url && config.anonKey) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      supabaseInstance = null;
    }
  }

  return supabaseInstance;
}

export function getCurrentConfig() {
  return currentConfig;
}
