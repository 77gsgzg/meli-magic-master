import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { logAuthEvent } from '@/lib/authTelemetry';
import { buildFullPath } from '@/lib/authRedirect';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; hasSession?: boolean }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null; hasSession?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const hadSessionRef = useRef(false);

  const auditUserData = async (userId: string, source: string) => {
    if (typeof supabase.from !== 'function') {
      logAuthEvent('profile_fetch_error', {
        source,
        userId,
        message: 'supabase.from unavailable in test/mock client',
      });
      return;
    }

    logAuthEvent('profile_fetch_start', { source, userId });
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[profile-real-error]', profileError);
      console.error('[rls]', 'profiles SELECT failed', profileError);
      logAuthEvent('profile_fetch_error', {
        source,
        userId,
        message: profileError.message,
        code: profileError.code,
      });
    } else {
      logAuthEvent('profile_fetch_resolved', { source, userId, exists: !!profile });
    }

    logAuthEvent('user_roles_fetch_start', { source, userId });
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (rolesError) {
      console.error('[user_roles-real-error]', rolesError);
      console.error('[rls]', 'user_roles SELECT failed', rolesError);
      logAuthEvent('user_roles_fetch_error', {
        source,
        userId,
        message: rolesError.message,
        code: rolesError.code,
      });
    } else {
      logAuthEvent('user_roles_fetch_resolved', {
        source,
        userId,
        roles: roles?.map((row) => row.role) ?? [],
      });
    }
  };

  useEffect(() => {
    let isMounted = true;
    logAuthEvent('init_start', {
      projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
      hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
      hasPublishableKey: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    });

    // 1) Auth state listener (fires on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED).
    //    Keep callback synchronous & non-blocking — no awaits inside.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        logAuthEvent('session_changed', {
          event,
          hasSession: !!newSession,
          userId: newSession?.user?.id ?? null,
          emailConfirmedAt: newSession?.user?.email_confirmed_at ?? null,
          expiresAt: newSession?.expires_at ?? null,
        });

        // Detect session loss after we previously had one => session expired / signed out elsewhere.
        if (event === 'SIGNED_OUT' && hadSessionRef.current) {
          hadSessionRef.current = false;
          logAuthEvent('signed_out', { trigger: 'auth_state_change' });
          toast.info('Sua sessão foi encerrada.');
        }

        if (newSession) {
          hadSessionRef.current = true;
          window.setTimeout(() => {
            void auditUserData(newSession.user.id, `auth_state:${event}`);
          }, 0);
        }
      }
    );

    // 2) Get initial session from storage — this is the source of truth on first render.
    //    Only set loading=false AFTER this resolves so guards don't redirect prematurely.
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      hadSessionRef.current = !!initialSession;
      setLoading(false);
      setInitialized(true);
      logAuthEvent('init_resolved', {
        hasSession: !!initialSession,
        userId: initialSession?.user?.id ?? null,
        emailConfirmedAt: initialSession?.user?.email_confirmed_at ?? null,
        expiresAt: initialSession?.expires_at ?? null,
      });
      if (initialSession) {
        void auditUserData(initialSession.user.id, 'initial_session');
      }
    }).catch((err) => {
      if (!isMounted) return;
      setLoading(false);
      setInitialized(true);
      logAuthEvent('init_resolved', { hasSession: false, error: String(err) });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      logAuthEvent('signin_start', { email });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[auth-real-error]', error);
        logAuthEvent('signin_error', {
          message: error.message,
          name: error.name,
          status: 'status' in error ? error.status : undefined,
        });
        return { error };
      }

      setSession(data.session);
      setUser(data.user);
      hadSessionRef.current = !!data.session;

      logAuthEvent('signin_resolved', {
        hasSession: !!data.session,
        userId: data.user?.id ?? null,
        emailConfirmedAt: data.user?.email_confirmed_at ?? null,
        expiresAt: data.session?.expires_at ?? null,
      });

      if (data.user) {
        void auditUserData(data.user.id, 'signin_success');
      }

      return { error: null, hasSession: !!data.session };
    } catch (err) {
      console.error('[auth-real-error]', err);
      logAuthEvent('signin_exception', { message: String(err) });
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      logAuthEvent('signup_start', { email, redirectUrl });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        console.error('[signup-real-error]', error);
        logAuthEvent('signup_error', {
          message: error.message,
          name: error.name,
          status: 'status' in error ? error.status : undefined,
        });
        return { error };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        hadSessionRef.current = true;
      }

      logAuthEvent('signup_resolved', {
        hasSession: !!data.session,
        userId: data.user?.id ?? null,
        emailConfirmedAt: data.user?.email_confirmed_at ?? null,
        identities: data.user?.identities?.length ?? 0,
      });

      if (data.user && data.session) {
        void auditUserData(data.user.id, 'signup_success');
      }

      return { error: null, hasSession: !!data.session };
    } catch (err) {
      console.error('[signup-real-error]', err);
      logAuthEvent('signup_exception', { message: String(err) });
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    logAuthEvent('signout_start', { userId: user?.id ?? null });
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[auth-real-error]', error);
      logAuthEvent('signout_error', { message: error.message });
      return;
    }
    setSession(null);
    setUser(null);
    hadSessionRef.current = false;
    logAuthEvent('signout_resolved');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, initialized, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook que garante autenticação. NÃO redireciona enquanto a sessão está sendo
 * carregada do storage — evita redirect prematuro logo após reload.
 */
export function useRequireAuth() {
  const { user, session, loading, initialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!initialized || loading) return;
    if (!user) {
      const from = buildFullPath(location);
      logAuthEvent('redirect_to_auth', {
        source: 'useRequireAuth',
        from,
        loading,
        initialized,
        hasUser: false,
      });
      toast.error('Você precisa estar logado para acessar esta página');
      navigate('/auth', {
        replace: true,
        state: { from, reason: 'unauthenticated' },
      });
    }
  }, [user, loading, initialized, navigate, location]);

  return { user, session, loading: loading || !initialized };
}
