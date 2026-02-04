import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useMercadoLivre } from './useMercadoLivre';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Detecta automaticamente o domínio atual para redirect_uri dinâmica
// IMPORTANTE: Registre AMBAS as URIs no painel do Mercado Livre:
// - https://gwjtwht.lovable.app/mercado-livre (produção)
// - https://preview--gwjtwht.lovable.app/mercado-livre (preview)
const OAUTH_CALLBACK_PATH = '/mercado-livre';

const getOrigin = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://gwjtwht.lovable.app';
};

// Usa a URL dinâmica baseada no ambiente atual
const getRedirectUri = () => getOrigin() + OAUTH_CALLBACK_PATH;

// Funções PKCE
const generateCodeVerifier = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const sha256 = async (plain: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
};

const base64urlEncode = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const hash = await sha256(codeVerifier);
  return base64urlEncode(hash);
};

/**
 * Hook que gerencia o fluxo OAuth do Mercado Livre com PKCE
 * Sempre usa o domínio raiz como redirect_uri para evitar erros de "Invalid Redirect URI"
 */
export function useMercadoLivreOAuth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const { handleCallback, checkConnection, getAuthUrl } = useMercadoLivre();
  const processedRef = useRef(false);
  const processingRef = useRef(false);

  // Storage keys (centralized)
  const STORAGE_KEYS = {
    state: 'ml_oauth_state',
    returnPath: 'ml_oauth_return_path',
    pkceVerifier: 'ml_pkce_code_verifier',
    pendingCode: 'ml_oauth_pending_code',
    pendingState: 'ml_oauth_pending_state',
    // Fallback that survives cross-origin redirects
    windowNamePrefix: 'ml_oauth:',
  } as const;

  // Utility: safe localStorage write with verification
  const safeSetItem = useCallback((key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      // Verify the write was successful
      const stored = localStorage.getItem(key);
      if (stored !== value) {
        console.error(`[ML OAuth] localStorage verification FAILED for ${key}`);
        return false;
      }
      console.log(`[ML OAuth] ✅ localStorage.setItem('${key}') = ${value.substring(0, 20)}...`);
      return true;
    } catch (e) {
      console.error(`[ML OAuth] localStorage.setItem FAILED for ${key}:`, e);
      return false;
    }
  }, []);

  // Utility: safe localStorage read
  const safeGetItem = useCallback((key: string): string | null => {
    try {
      const value = localStorage.getItem(key);
      console.log(`[ML OAuth] localStorage.getItem('${key}') = ${value ? value.substring(0, 20) + '...' : 'NULL'}`);
      return value;
    } catch (e) {
      console.error(`[ML OAuth] localStorage.getItem FAILED for ${key}:`, e);
      return null;
    }
  }, []);

  const writeWindowNameSession = useCallback((payload: { state: string; codeVerifier: string; returnPath: string }) => {
    try {
      // window.name survives full-page navigations across different origins
      const data = JSON.stringify({ ...payload, createdAt: Date.now() });
      window.name = `${STORAGE_KEYS.windowNamePrefix}${data}`;
      console.log('[ML OAuth] ✅ window.name fallback salvo:', payload.state.substring(0, 10) + '...');
    } catch (e) {
      console.error('[ML OAuth] ❌ Falha ao salvar window.name fallback:', e);
    }
  }, []);

  const readWindowNameSession = useCallback((): { state?: string; codeVerifier?: string; returnPath?: string } | null => {
    try {
      console.log('[ML OAuth] Verificando window.name:', window.name?.substring(0, 30) + '...');
      if (!window.name?.startsWith(STORAGE_KEYS.windowNamePrefix)) {
        console.log('[ML OAuth] window.name não contém dados OAuth');
        return null;
      }
      const raw = window.name.slice(STORAGE_KEYS.windowNamePrefix.length);
      const parsed = JSON.parse(raw);
      console.log('[ML OAuth] ✅ window.name parsed com sucesso');
      return {
        state: typeof parsed?.state === 'string' ? parsed.state : undefined,
        codeVerifier: typeof parsed?.codeVerifier === 'string' ? parsed.codeVerifier : undefined,
        returnPath: typeof parsed?.returnPath === 'string' ? parsed.returnPath : undefined,
      };
    } catch (e) {
      console.error('[ML OAuth] ❌ Falha ao ler window.name:', e);
      return null;
    }
  }, []);

  const clearWindowNameSession = useCallback(() => {
    try {
      if (window.name?.startsWith(STORAGE_KEYS.windowNamePrefix)) {
        window.name = '';
        console.log('[ML OAuth] window.name limpo');
      }
    } catch {
      // ignore
    }
  }, []);

  // Gera uma string de state aleatória para proteção CSRF
  const generateState = useCallback(() => {
    const state = crypto.randomUUID().replace(/-/g, '');
    const stateSaved = safeSetItem(STORAGE_KEYS.state, state);
    const pathSaved = safeSetItem(STORAGE_KEYS.returnPath, location.pathname);
    
    if (!stateSaved || !pathSaved) {
      console.error('[ML OAuth] ❌ CRÍTICO: Falha ao salvar state no localStorage!');
    }
    
    return state;
  }, [location.pathname, safeSetItem]);

  // Gera e armazena o code_verifier para PKCE
  const generateAndStorePKCE = useCallback(async () => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    const saved = safeSetItem(STORAGE_KEYS.pkceVerifier, codeVerifier);
    
    if (!saved) {
      console.error('[ML OAuth] ❌ CRÍTICO: Falha ao salvar code_verifier no localStorage!');
    }
    
    return { codeVerifier, codeChallenge };
  }, [safeSetItem]);

  // Recupera o code_verifier armazenado
  const getStoredCodeVerifier = useCallback((): string | null => {
    console.log('[ML OAuth] === Recuperando code_verifier ===');
    
    // Primeiro tenta localStorage
    let codeVerifier = safeGetItem(STORAGE_KEYS.pkceVerifier);
    
    if (!codeVerifier) {
      console.log('[ML OAuth] code_verifier não encontrado no localStorage, tentando window.name...');
      // Fallback: window.name survives cross-origin redirects
      const w = readWindowNameSession();
      if (w?.codeVerifier) {
        codeVerifier = w.codeVerifier;
        console.log('[ML OAuth] ✅ code_verifier recuperado via window.name!');
        // Rehydrate localStorage for subsequent reads
        safeSetItem(STORAGE_KEYS.pkceVerifier, codeVerifier);
        if (w.state) {
          safeSetItem(STORAGE_KEYS.state, w.state);
        }
        if (w.returnPath) {
          safeSetItem(STORAGE_KEYS.returnPath, w.returnPath);
        }
      }
    }
    
    if (codeVerifier) {
      console.log('[ML OAuth] ✅ code_verifier disponível:', codeVerifier.substring(0, 20) + '...');
    } else {
      console.error('[ML OAuth] ❌ NENHUM code_verifier encontrado em localStorage NEM window.name!');
    }
    
    return codeVerifier;
  }, [readWindowNameSession, safeGetItem, safeSetItem]);

  // Limpa o code_verifier após uso
  const clearPKCE = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.pkceVerifier);
      clearWindowNameSession();
      console.log('[ML OAuth] PKCE limpo');
    } catch (e) {
      console.error('[ML OAuth] Erro ao limpar PKCE:', e);
    }
  }, [clearWindowNameSession]);

  // Valida o state retornado (tolerante quando ML não retorna state)
  const validateState = useCallback((returnedState: string | null): boolean => {
    console.log('[ML OAuth] === Validando state ===');
    console.log('[ML OAuth] State retornado pela URL:', returnedState);
    
    let storedState = safeGetItem(STORAGE_KEYS.state);
    
    if (!storedState) {
      console.log('[ML OAuth] State não encontrado no localStorage, tentando window.name...');
      const w = readWindowNameSession();
      if (w?.state) {
        storedState = w.state;
        console.log('[ML OAuth] ✅ State recuperado via window.name!');
        safeSetItem(STORAGE_KEYS.state, storedState);
        if (w.returnPath) {
          safeSetItem(STORAGE_KEYS.returnPath, w.returnPath);
        }
      }
    }
    
    // Se não há state armazenado, permite (primeira conexão ou sessão expirada)
    if (!storedState) {
      console.log('[ML OAuth] ⚠️ Nenhum state armazenado, permitindo callback (primeira conexão)');
      return true;
    }
    
    // Se ML não retornou state mas temos um armazenado, permite
    if (!returnedState) {
      console.log('[ML OAuth] ⚠️ ML não retornou state, permitindo callback');
      localStorage.removeItem(STORAGE_KEYS.state);
      return true;
    }
    
    // Valida se os states coincidem
    if (returnedState !== storedState) {
      console.error('[ML OAuth] ❌ State MISMATCH:', { returned: returnedState, stored: storedState });
      localStorage.removeItem(STORAGE_KEYS.state);
      return false;
    }
    
    console.log('[ML OAuth] ✅ State validado com sucesso!');
    localStorage.removeItem(STORAGE_KEYS.state);
    return true;
  }, [readWindowNameSession, safeGetItem, safeSetItem]);

  // Processa o callback OAuth
  const processCallback = useCallback(async (code: string, state: string | null) => {
    // Evita processamento duplo
    if (processingRef.current || processedRef.current) {
      console.log('[ML OAuth] Callback já processado ou em processamento, ignorando');
      return;
    }
    
    processingRef.current = true;
    console.log('[ML OAuth] Iniciando processamento do callback com code:', code?.substring(0, 10) + '...');
    
    try {
      // Valida (e principalmente LIMPA) o state para evitar loops.
      // Importante: o ML às vezes não retorna `state`, então validamos mesmo assim
      // para consumir o valor armazenado no localStorage.
      if (!validateState(state)) {
        toast.error('Erro de segurança na autenticação. Tente novamente.');
        return;
      }

      // Recupera o code_verifier para PKCE
      const codeVerifier = getStoredCodeVerifier();
      if (!codeVerifier) {
        console.error('[ML OAuth] code_verifier não encontrado - fluxo PKCE incompleto');
        toast.error('Sessão de autorização expirada. Tente conectar novamente.');
        // Limpa os parâmetros da URL para permitir nova tentativa
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      console.log('[ML OAuth] code_verifier recuperado, chamando handleCallback...');

      // IMPORTANTE: Usa sempre a URI fixa registrada no ML
      const redirectUri = getRedirectUri();
      console.log('[ML OAuth] redirect_uri para callback:', redirectUri);
      
      const success = await handleCallback(code, redirectUri, codeVerifier);
      
      console.log('[ML OAuth] handleCallback resultado:', success);
      
      // Limpa o PKCE após uso
      clearPKCE();
      
      if (success) {
        processedRef.current = true;
        
        // Limpa os parâmetros da URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('code');
        newParams.delete('state');
        
        // Recupera a rota de retorno salva
      const returnPath = localStorage.getItem(STORAGE_KEYS.returnPath) || '/mercado-livre';
      localStorage.removeItem(STORAGE_KEYS.returnPath);
        
        // Atualiza a URL sem os parâmetros OAuth
        window.history.replaceState({}, document.title, returnPath);
        
        // Atualiza o estado da conexão
        await checkConnection();
        
        toast.success('Mercado Livre conectado com sucesso!');
        
        // Navega para a página de conexão ou retorna à rota salva
        if (returnPath !== location.pathname) {
          navigate(returnPath);
        }
      } else {
        // Se falhou, limpa URL para permitir nova tentativa
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('[ML OAuth] Erro ao processar callback OAuth:', error);
      toast.error('Erro ao conectar com Mercado Livre. Tente novamente.');
      clearPKCE();
      // Limpa URL para permitir nova tentativa
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      processingRef.current = false;
    }
  }, [handleCallback, checkConnection, validateState, getStoredCodeVerifier, clearPKCE, searchParams, navigate, location.pathname]);

  // Inicia o fluxo de autorização com PKCE
  const startAuth = useCallback(async () => {
    try {
      console.log('[ML OAuth] ========== INICIANDO FLUXO OAuth ==========');
      
      const state = generateState();
      const { codeVerifier, codeChallenge } = await generateAndStorePKCE();
      const redirectUri = getRedirectUri();

      // Verificação FINAL antes do redirect
      const verifyState = safeGetItem(STORAGE_KEYS.state);
      const verifyVerifier = safeGetItem(STORAGE_KEYS.pkceVerifier);
      
      if (!verifyState || !verifyVerifier) {
        console.error('[ML OAuth] ❌ CRÍTICO: Dados não persistidos no localStorage!');
        toast.error('Erro ao preparar conexão. Verifique se localStorage está habilitado.');
        return false;
      }
      
      console.log('[ML OAuth] ✅ Verificação pré-redirect OK:');
      console.log('[ML OAuth]   - state:', verifyState.substring(0, 10) + '...');
      console.log('[ML OAuth]   - code_verifier:', verifyVerifier.substring(0, 10) + '...');

      // Extra fallback (survives cross-origin redirects)
      writeWindowNameSession({ state, codeVerifier, returnPath: location.pathname });
      
      console.log('[ML OAuth] redirect_uri:', redirectUri);
      
      const authUrl = await getAuthUrl(redirectUri, codeChallenge);
      
      if (authUrl) {
        // Adiciona o state à URL de autorização se não estiver presente
        const url = new URL(authUrl);
        if (!url.searchParams.has('state')) {
          url.searchParams.set('state', state);
        }
        
        console.log('[ML OAuth] 🚀 Redirecionando para ML...');
        window.location.href = url.toString();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[ML OAuth] Erro ao iniciar autenticação:', error);
      toast.error('Erro ao iniciar conexão com Mercado Livre');
      return false;
    }
  }, [generateState, generateAndStorePKCE, getAuthUrl, writeWindowNameSession, location.pathname]);

  // Detecta e processa callback OAuth automaticamente
  // Aguarda a sessão estar disponível antes de processar
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    // Aguarda o carregamento da autenticação terminar
    if (authLoading) {
      console.log('[ML OAuth] Aguardando carregamento da sessão...');
      return;
    }
    
    // Verifica se temos uma sessão válida
    if (!session) {
      console.log('[ML OAuth] Sem sessão ativa, redirecionando para login...');
      if (code) {
        // Salva o code para processar após login
        localStorage.setItem(STORAGE_KEYS.pendingCode, code);
        if (state) {
          localStorage.setItem(STORAGE_KEYS.pendingState, state);
        }
        toast.error('Faça login para continuar a conexão com Mercado Livre');
        navigate('/auth');
      }
      return;
    }
    
    // Verifica se há um code pendente do redirecionamento
    const pendingCode = localStorage.getItem(STORAGE_KEYS.pendingCode);
    const pendingState = localStorage.getItem(STORAGE_KEYS.pendingState);
    
    if (pendingCode && !code) {
      console.log('[ML OAuth] Processando code pendente após login');
      localStorage.removeItem(STORAGE_KEYS.pendingCode);
      localStorage.removeItem(STORAGE_KEYS.pendingState);
      processCallback(pendingCode, pendingState);
      return;
    }
    
    if (code && !processedRef.current && !processingRef.current) {
      console.log('[ML OAuth] Sessão disponível, processando callback...');
      processCallback(code, state);
    }
  }, [searchParams, processCallback, authLoading, session, navigate]);

  // Reseta o estado de processamento quando o componente é remontado
  useEffect(() => {
    return () => {
      // Não reseta se ainda estiver processando
      if (!processingRef.current) {
        processedRef.current = false;
      }
    };
  }, []);

  return {
    startAuth,
    isProcessingCallback: processingRef.current,
    hasProcessedCallback: processedRef.current,
  };
}

/**
 * Constantes exportadas para uso em outros componentes
 */
export const ML_OAUTH_CONFIG = {
  CALLBACK_PATH: OAUTH_CALLBACK_PATH,
  getRedirectUri,
};
