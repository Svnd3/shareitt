import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// supabase-js serializes auth operations (token exchange/refresh, sign-in,
// etc.) behind an internal lock and only releases it once the underlying
// fetch settles. The browser's fetch() never times out on its own, so a
// single hung request (e.g. a cold-starting Supabase project) can hold that
// lock forever and freeze every subsequent auth/REST/function call. Force a
// hard timeout on every request this client makes so the lock can never get
// stuck.
const FETCH_TIMEOUT_MS = 15000;
function fetchWithTimeout(input, init = {}) {
  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(input, { ...init, signal });
}

function makeMockBuilder() {
  const resp = () => Promise.resolve({ data: null, error: null });
  const builder = {
    select: () => builder,
    order: () => resp(),
    eq: () => builder,
    then: (cb) => resp().then(cb),
    insert: () => resp(),
    update: () => builder,
    single: () => resp(),
  };
  return builder;
}

let supabase;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  // Provide a safe mock so importing this file doesn't not crash the app when env is missing.
  // Show a visible error in the UI instead of silently rendering empty data.
  // eslint-disable-next-line no-console
  console.error(
    "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Add these variables to .env or Vercel environment settings.",
  );

  supabase = {
    from: () => makeMockBuilder(),
    auth: {
      signInWithPassword: async () => ({ data: null, error: null }),
      signUp: async () => ({ data: null, error: null }),
      signInWithOAuth: async () => ({ data: null, error: null }),
      signOut: async () => ({ data: null, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  };
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // PKCE protects the OAuth/email-link exchange from authorization-code
      // interception — the verifier never leaves this browser.
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      // Handled manually in App.jsx with a timeout. supabase-js awaits its
      // internal init (including the automatic code exchange this would
      // trigger) before *every* auth/REST call — if that exchange hangs
      // (e.g. a cold-starting Supabase project), it freezes the whole app.
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  });
}

export { supabase, hasSupabaseConfig, supabaseUrl, supabaseAnonKey };
