// src/contexts/AuthContext.tsx
// Supabase Auth state for Project Sennzo (Prompt #21).
//
// Provides: user, role, driverProfileId, loading, signIn, signOut
//
// Role comes from user.app_metadata.role set at user creation.
// Valid roles: 'coach' (Mark), 'parent' (Erika), 'enzo' (all drivers)
//
// On auth state change, syncs role → sessionStorage('sennzo_role')
// so that existing portal role-gates pick it up without modification.
//
// Dev fallback: if VITE_DEV_ROLE is set and no Supabase session exists,
// behaves as if that role is authenticated. Useful for local dev without
// running through the login page.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SennzoRole = 'coach' | 'parent' | 'enzo' | '';

export interface AuthState {
  user:            User | null;
  role:            SennzoRole;
  driverProfileId: string | null;  // driver_profile.id for the enzo role
  loading:         boolean;
  signIn:  (email: string, password: string) => Promise<string | null>;  // returns error msg or null
  signOut: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState>({
  user:            null,
  role:            '',
  driverProfileId: null,
  loading:         true,
  signIn:          async () => null,
  signOut:         async () => {},
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_KEY   = 'sennzo_role';
const DEV_ROLE   = (import.meta.env.VITE_DEV_ROLE ?? '') as SennzoRole;

function roleFromUser(u: User | null): SennzoRole {
  if (!u) return DEV_ROLE || '';
  const r = (u.app_metadata?.role ?? '') as SennzoRole;
  return r;
}

/**
 * Lookup driver_profile.id for the signed-in user.
 * Only relevant for enzo-role users who have a driver profile.
 */
async function fetchDriverProfileId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('driver_profile')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,            setUser]            = useState<User | null>(null);
  const [role,            setRole]            = useState<SennzoRole>(DEV_ROLE || '');
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);
  const [loading,         setLoading]         = useState(true);

  // Sync role → sessionStorage so existing portal role-gates work
  const applyRole = useCallback(async (u: User | null) => {
    const r = roleFromUser(u);
    setRole(r);
    if (r) {
      sessionStorage.setItem(ROLE_KEY, r);
    } else {
      sessionStorage.removeItem(ROLE_KEY);
    }

    // Resolve driver profile id for enzo-role users
    if (u && r === 'enzo') {
      const id = await fetchDriverProfileId(u.id);
      setDriverProfileId(id);
    } else {
      setDriverProfileId(null);
    }
  }, []);

  // ── Bootstrap — load existing session ───────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      await applyRole(u);
      setLoading(false);
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        await applyRole(u);
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [applyRole]);

  // ── Sign-in ─────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  // ── Sign-out ────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(ROLE_KEY);
    setRole('');
    setUser(null);
    setDriverProfileId(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, driverProfileId, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
