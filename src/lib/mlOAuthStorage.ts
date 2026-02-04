export const ML_OAUTH_STORAGE_KEYS = {
  state: "ml_oauth_state",
  returnPath: "ml_oauth_return_path",
  pkceVerifier: "ml_pkce_code_verifier",
  pendingCode: "ml_oauth_pending_code",
  pendingState: "ml_oauth_pending_state",
} as const;

type Key = (typeof ML_OAUTH_STORAGE_KEYS)[keyof typeof ML_OAUTH_STORAGE_KEYS];

export function lsSetVerified(key: Key, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

export function lsGet(key: Key): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsRemove(...keys: Key[]) {
  try {
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * Limpa somente o cache do OAuth do Mercado Livre (não mexe no login do app).
 */
export function clearMlOAuthCache() {
  lsRemove(
    ML_OAUTH_STORAGE_KEYS.state,
    ML_OAUTH_STORAGE_KEYS.returnPath,
    ML_OAUTH_STORAGE_KEYS.pkceVerifier,
    ML_OAUTH_STORAGE_KEYS.pendingCode,
    ML_OAUTH_STORAGE_KEYS.pendingState
  );
}
