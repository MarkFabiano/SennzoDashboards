// src/lib/supabaseClient.ts
// Shared Supabase client — single instance for the whole SPA.
// All auth state flows through this client; import it instead of creating new ones.

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL      ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
);
