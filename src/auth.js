import { getSupabaseClient, getSupabaseCredentials } from './supabase.js';

const DEMO_USER_KEY = 'supermarket_app_demo_user';

// Mock user for Demo Mode when Supabase is not connected
const MOCK_DEMO_USER = {
  id: 'demo-user-12345',
  email: 'demo@example.com',
  user_metadata: { name: 'デモユーザー' }
};

let currentUser = null;
let authListeners = [];

/**
 * Register auth status change listener
 */
export function onAuthStateChanged(callback) {
  authListeners.push(callback);
  // Immediate trigger with current state
  callback(currentUser);
  return () => {
    authListeners = authListeners.filter(cb => cb !== callback);
  };
}

function notifyListeners() {
  authListeners.forEach(cb => cb(currentUser));
}

/**
 * Initialize Auth State Listener
 */
export async function initAuth() {
  const { isDemo } = getSupabaseCredentials();
  const client = getSupabaseClient();

  if (isDemo || !client) {
    const storedDemoUser = localStorage.getItem(DEMO_USER_KEY);
    if (storedDemoUser) {
      try {
        currentUser = JSON.parse(storedDemoUser);
      } catch {
        currentUser = MOCK_DEMO_USER;
      }
    } else {
      currentUser = MOCK_DEMO_USER;
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(MOCK_DEMO_USER));
    }
    notifyListeners();
    return currentUser;
  }

  // Real Supabase Auth
  try {
    const { data: { session } } = await client.auth.getSession();
    currentUser = session?.user || null;
    notifyListeners();

    client.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      notifyListeners();
    });
  } catch (err) {
    console.error('Error initializing Auth:', err);
    currentUser = null;
    notifyListeners();
  }

  return currentUser;
}

/**
 * Sign up with Email and Password
 */
export async function signUp(email, password) {
  const { isDemo } = getSupabaseCredentials();
  const client = getSupabaseClient();

  if (isDemo || !client) {
    currentUser = {
      id: 'demo-user-' + Date.now(),
      email: email,
      user_metadata: { name: email.split('@')[0] }
    };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(currentUser));
    notifyListeners();
    return { user: currentUser, error: null };
  }

  const { data, error } = await client.auth.signUp({
    email,
    password
  });

  if (!error && data?.user) {
    currentUser = data.user;
    notifyListeners();
  }

  return { user: data?.user, error };
}

/**
 * Sign in with Email and Password
 */
export async function signIn(email, password) {
  const { isDemo } = getSupabaseCredentials();
  const client = getSupabaseClient();

  if (isDemo || !client) {
    currentUser = {
      id: 'demo-user-' + Date.now(),
      email: email,
      user_metadata: { name: email.split('@')[0] }
    };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(currentUser));
    notifyListeners();
    return { user: currentUser, error: null };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (!error && data?.user) {
    currentUser = data.user;
    notifyListeners();
  }

  return { user: data?.user, error };
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { isDemo } = getSupabaseCredentials();
  const client = getSupabaseClient();

  if (isDemo || !client) {
    localStorage.removeItem(DEMO_USER_KEY);
    currentUser = null;
    notifyListeners();
    return { error: null };
  }

  const { error } = await client.auth.signOut();
  if (!error) {
    currentUser = null;
    notifyListeners();
  }
  return { error };
}

/**
 * Get current logged in user object
 */
export function getCurrentUser() {
  return currentUser;
}
