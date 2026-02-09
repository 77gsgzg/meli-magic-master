import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useMercadoLivre } from './useMercadoLivre';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// URI fixo de produção — deve ser idêntico ao cadastrado no painel do Mercado Livre
const ML_REDIRECT_URI = 'https://eshysysha.lovable.app/';

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

  // Gera uma string de state aleatória para proteção CSRF
  const generateState = useCallback(() => {
    const state = crypto.randomUUID().replace(/-/g, '');
    sessionStorage.setItem('ml_oauth_state', state);
    // Salva a rota atual para retornar após o callback
    sessionStorage.setItem('ml_oauth_return_path', location.pathname);
    return state;
  }, [location.pathname]);

  // Gera e armazena o code_verifier para PKCE
  const generateAndStorePKCE = useCallback(async () => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    sessionStorage.setItem('ml_pkce_code_verifier', codeVerifier);
    console.log('[ML OAuth] PKCE code_verifier gerado e armazenado');
    
    return { codeVerifier, codeChallenge };
  }, []);

  // Recupera o code_verifier armazenado
  const getStoredCodeVerifier = useCallback((): string | null => {
    const codeVerifier = sessionStorage.getItem('ml_pkce_code_verifier');
    if (codeVerifier) {
      console.log('[ML OAuth] code_verifier recuperado do storage');
    } else {
      console.warn('[ML OAuth] Nenhum code_verifier encontrado no storage');
    }
    return codeVerifier;
  }, []);

  // Limpa o code_verifier após uso
  const clearPKCE = useCallback(() => {
    sessionStorage.removeItem('ml_pkce_code_verifier');
    console.log('[ML OAuth] PKCE limpo do storage');
  }, []);

  // Valida o state retornado (tolerante quando ML não retorna state)
  const validateState = useCallback((returnedState: string | null): boolean => {
    const storedState = sessionStorage.getItem('ml_oauth_state');
    
    // Se não há state armazenado, permite (primeira conexão ou sessão expirada)
    if (!storedState) {
      console.log('[ML OAuth] Nenhum state armazenado, permitindo callback');
      return true;
    }
    
    // Se ML não retornou state mas temos um armazenado, permite (ML às vezes não retorna)
    if (!returnedState) {
      console.log('[ML OAuth] ML não retornou state, permitindo callback');
      sessionStorage.removeItem('ml_oauth_state');
      return true;
    }
    
    // Valida se os states coincidem
    if (returnedState !== storedState) {
      console.error('[ML OAuth] State mismatch:', { returned: returnedState, stored: storedState });
      sessionStorage.removeItem('ml_oauth_state');
      return false;
    }
    
    console.log('[ML OAuth] State validado com sucesso');
    sessionStorage.removeItem('ml_oauth_state');
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
      // Valida o state para segurança CSRF
      if (state && !validateState(state)) {
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

      console.log('[ML OAuth] redirect_uri para callback:', ML_REDIRECT_URI);
      
      const success = await handleCallback(code, ML_REDIRECT_URI, codeVerifier);
      
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
        const returnPath = sessionStorage.getItem('ml_oauth_return_path') || '/mercado-livre';
        sessionStorage.removeItem('ml_oauth_return_path');
        
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
      const state = generateState();
      const { codeChallenge } = await generateAndStorePKCE();
      
      console.log('[ML OAuth] Iniciando auth com PKCE, redirect_uri:', ML_REDIRECT_URI);
      
      const authUrl = await getAuthUrl(ML_REDIRECT_URI, codeChallenge);
      
      if (authUrl) {
        // Adiciona o state à URL de autorização se não estiver presente
        const url = new URL(authUrl);
        if (!url.searchParams.has('state')) {
          url.searchParams.set('state', state);
        }
        
        console.log('[ML OAuth] Redirecionando para ML com PKCE');
        window.location.href = url.toString();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao iniciar autenticação:', error);
      toast.error('Erro ao iniciar conexão com Mercado Livre');
      return false;
    }
  }, [generateState, generateAndStorePKCE, getAuthUrl]);

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
        sessionStorage.setItem('ml_oauth_pending_code', code);
        if (state) {
          sessionStorage.setItem('ml_oauth_pending_state', state);
        }
        toast.error('Faça login para continuar a conexão com Mercado Livre');
        navigate('/auth');
      }
      return;
    }
    
    // Verifica se há um code pendente do redirecionamento
    const pendingCode = sessionStorage.getItem('ml_oauth_pending_code');
    const pendingState = sessionStorage.getItem('ml_oauth_pending_state');
    
    if (pendingCode && !code) {
      console.log('[ML OAuth] Processando code pendente após login');
      sessionStorage.removeItem('ml_oauth_pending_code');
      sessionStorage.removeItem('ml_oauth_pending_state');
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
  REDIRECT_URI: ML_REDIRECT_URI,
  getRedirectUri: () => ML_REDIRECT_URI,
};
