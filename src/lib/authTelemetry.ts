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
  | "signin_start"
  | "signin_resolved"
  | "signin_error"
  | "signin_exception"
  | "signup_start"
  | "signup_resolved"
  | "signup_error"
  | "signup_exception"
  | "signout_start"
  | "signout_resolved"
  | "signout_error"
  | "signed_out"
  | "profile_fetch_start"
  | "profile_fetch_resolved"
  | "profile_fetch_error"
  | "user_roles_fetch_start"
  | "user_roles_fetch_resolved"
  | "user_roles_fetch_error"
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
  };
  if (details !== undefined) payload.details = details;

  buffer.push(payload);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();

  if (typeof window !== "undefined") {
    (window as unknown as { __authEvents?: AuthEventPayload[] }).__authEvents = buffer;
  }

  // Logging visível apenas em dev. Em prod, fica em window.__authEvents.
  if (import.meta.env?.DEV) {
    const channel = getAuthLogChannel(event);
    // eslint-disable-next-line no-console
    console.debug(`[${channel}] ${event}`, details ?? "");
  }
}

function getAuthLogChannel(event: AuthEvent): string {
  if (event.startsWith("signin") || event === "init_start") return "auth";
  if (event.startsWith("signup")) return "signup";
  if (event.startsWith("profile")) return "profile";
  if (event.startsWith("user_roles")) return "user_roles";
  if (event.startsWith("redirect")) return "redirect";
  if (event.includes("session") || event === "signed_out" || event.startsWith("signout")) return "session";
  return "auth";
}

export function getAuthEvents(): AuthEventPayload[] {
  return [...buffer];
}

/** Limpa o buffer. Útil em testes. */
export function __resetAuthEvents() {
  buffer.length = 0;
  if (typeof window !== "undefined") {
    (window as unknown as { __authEvents?: AuthEventPayload[] }).__authEvents = buffer;
  }
}
