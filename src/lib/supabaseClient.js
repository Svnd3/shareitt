import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function makeMockBuilder() {
  const resp = () => Promise.resolve({ data: null, error: null });
  return {
    select: () => ({
      order: () => resp(),
      eq: () => ({ single: () => resp() }),
      then: (cb) => resp().then(cb),
    }),
    order: () => resp(),
    eq: () => ({ single: () => resp() }),
    insert: () => resp(),
    update: () => ({ eq: () => resp() }),
    single: () => resp(),
  };
}

let supabase;

if (!supabaseUrl || !supabaseAnonKey) {
  // Provide a safe mock so importing this file doesn't crash the app when env is missing.
  // Components will fall back to `defaultFamilies` when Supabase responses are empty.
  // eslint-disable-next-line no-console
  console.warn(
    "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — using fallback mock supabase. Add .env to enable live Supabase connection.",
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
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
