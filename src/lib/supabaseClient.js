import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
      detectSessionInUrl: true,
    },
  });
}

export { supabase, hasSupabaseConfig };
