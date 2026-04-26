import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // 1) Auth state listener (fires on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED).
    //    Keep callback synchronous & non-blocking — no awaits inside.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Detect session loss after we previously had one => session expired / signed out elsewhere.
        if (event === 'SIGNED_OUT' && hadSessionRef.current) {
          hadSessionRef.current = false;
          toast.info('Sua sessão foi encerrada.');
        }

        if (newSession) {
          hadSessionRef.current = true;
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
    }).catch(() => {
      if (!isMounted) return;
      setLoading(false);
      setInitialized(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: new Error('Email ou senha incorretos') };
        }
        return { error };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
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
        if (error.message.includes('User already registered')) {
          return { error: new Error('Este email já está cadastrado') };
        }
        return { error };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
      toast.error('Você precisa estar logado para acessar esta página');
      navigate('/auth', {
        replace: true,
        state: { from: location.pathname + location.search },
      });
    }
  }, [user, loading, initialized, navigate, location.pathname, location.search]);

  return { user, session, loading: loading || !initialized };
}
