/**
 * Telemetria leve para fluxo de autenticação.
 * - Em dev: console.debug com prefixo [auth].
 * - Em prod: silencioso por padrão; expõe window.__authEvents para inspeção manual.
 *
 * Objetivo: rastrear POR QUE houve redirect para /auth e qual era o estado
 * (loading / initialized / user) no momento da decisão.
 */

export type AuthEvent =
  | "init_start"
  | "init_resolved"
  | "session_changed"
  | "signed_out"
  | "redirect_to_auth"
  | "redirect_blocked_loading"
  | "redirect_admin_denied"
  | "session_expired";

interface AuthEventPayload {
  event: AuthEvent;
  at: string;
  details?: Record<string, unknown>;
}

const BUFFER_LIMIT = 50;
const buffer: AuthEventPayload[] = [];

export function logAuthEvent(event: AuthEvent, details?: Record<string, unknown>) {
  const payload: AuthEventPayload = {
    event,
    at: new Date().toISOString(),
    details,
  };

  buffer.push(payload);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();

  if (typeof window !== "undefined") {
    (window as unknown as { __authEvents?: AuthEventPayload[] }).__authEvents = buffer;
  }

  // Logging visível apenas em dev. Em prod, fica em window.__authEvents.
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[auth] ${event}`, details ?? "");
  }
}

export function getAuthEvents(): AuthEventPayload[] {
  return [...buffer];
}
