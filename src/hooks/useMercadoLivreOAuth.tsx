import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useMercadoLivre } from './useMercadoLivre';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import {
  ML_OAUTH_STORAGE_KEYS,
  clearMlOAuthCache,
  lsGet,
  lsRemove,
  lsSetVerified,
} from '@/lib/mlOAuthStorage';

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

  // Compat: manter nome antigo usado no arquivo (minimiza diff)
  const STORAGE_KEYS = ML_OAUTH_STORAGE_KEYS;

  // Gera uma string de state aleatória para proteção CSRF
  const generateState = useCallback(() => {
    const state = crypto.randomUUID().replace(/-/g, '');
    const stateSaved = lsSetVerified(STORAGE_KEYS.state, state);
    const pathSaved = lsSetVerified(STORAGE_KEYS.returnPath, location.pathname);
    
    if (!stateSaved || !pathSaved) {
      console.error('[ML OAuth] ❌ CRÍTICO: Falha ao salvar state no localStorage!');
    }
    
    return state;
  }, [location.pathname]);

  // Gera e armazena o code_verifier para PKCE
  const generateAndStorePKCE = useCallback(async () => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    const saved = lsSetVerified(STORAGE_KEYS.pkceVerifier, codeVerifier);
    
    if (!saved) {
      console.error('[ML OAuth] ❌ CRÍTICO: Falha ao salvar code_verifier no localStorage!');
    }
    
    return { codeVerifier, codeChallenge };
  }, []);

  // Recupera o code_verifier armazenado (SOMENTE localStorage)
  const getStoredCodeVerifier = useCallback((): string | null => {
    console.log('[ML OAuth] === Recuperando code_verifier ===');

    const codeVerifier = lsGet(STORAGE_KEYS.pkceVerifier);
    
    if (codeVerifier) {
      console.log('[ML OAuth] ✅ code_verifier disponível:', codeVerifier.substring(0, 20) + '...');
    } else {
      console.error('[ML OAuth] ❌ code_verifier NÃO encontrado em nenhum storage!');
    }
    
    return codeVerifier;
  }, []);

  // Limpa o code_verifier/state/returnPath (somente localStorage)
  const clearPKCE = useCallback(() => {
    try {
      lsRemove(STORAGE_KEYS.pkceVerifier, STORAGE_KEYS.state, STORAGE_KEYS.returnPath);
      console.log('[ML OAuth] PKCE e state limpos do localStorage');
    } catch (e) {
      console.error('[ML OAuth] Erro ao limpar PKCE:', e);
    }
  }, []);

  // Valida o state retornado (tolerante quando ML não retorna state)
  const validateState = useCallback((returnedState: string | null): boolean => {
    console.log('[ML OAuth] === Validando state ===');
    console.log('[ML OAuth] State retornado pela URL:', returnedState);
    
    const storedState = lsGet(STORAGE_KEYS.state);
    
    // Se não há state armazenado, permite (primeira conexão ou sessão expirada)
    if (!storedState) {
      console.log('[ML OAuth] ⚠️ Nenhum state armazenado, permitindo callback (primeira conexão)');
      return true;
    }
    
    // Se ML não retornou state mas temos um armazenado, permite
    if (!returnedState) {
      console.log('[ML OAuth] ⚠️ ML não retornou state, permitindo callback');
      lsRemove(STORAGE_KEYS.state);
      return true;
    }
    
    // Valida se os states coincidem
    if (returnedState !== storedState) {
      console.error('[ML OAuth] ❌ State MISMATCH:', { returned: returnedState, stored: storedState });
      lsRemove(STORAGE_KEYS.state);
      return false;
    }
    
    console.log('[ML OAuth] ✅ State validado com sucesso!');
    lsRemove(STORAGE_KEYS.state);
    return true;
  }, []);

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

      // Estabilização: limpa resíduos de tentativas anteriores para evitar conflito
      clearMlOAuthCache();
      
      const state = generateState();
      const { codeVerifier, codeChallenge } = await generateAndStorePKCE();
      const redirectUri = getRedirectUri();

      // Verificação FINAL antes do redirect
      const verifyState = lsGet(STORAGE_KEYS.state);
      const verifyVerifier = lsGet(STORAGE_KEYS.pkceVerifier);
      
      if (!verifyState || !verifyVerifier) {
        console.error('[ML OAuth] ❌ CRÍTICO: Dados não persistidos no localStorage!');
        toast.error('Erro ao preparar conexão. Verifique se localStorage está habilitado.');
        return false;
      }
      
      console.log('[ML OAuth] ✅ Verificação pré-redirect OK:');
      console.log('[ML OAuth]   - state:', verifyState.substring(0, 10) + '...');
      console.log('[ML OAuth]   - code_verifier:', verifyVerifier.substring(0, 10) + '...');

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
  }, [generateState, generateAndStorePKCE, getAuthUrl, location.pathname]);


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
