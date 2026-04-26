/**
 * Helpers para preservar e restaurar o destino do usuário entre /auth e a rota privada.
 * Suporta pathname + search (?...) + hash (#...).
 */

import type { Location } from "react-router-dom";

export interface RedirectState {
  from?: string;
  reason?: "unauthenticated" | "session_expired" | "forbidden";
}

/** Monta a URL completa relativa (path + search + hash) a partir de um Location. */
export function buildFullPath(location: Pick<Location, "pathname" | "search" | "hash">): string {
  return `${location.pathname || "/"}${location.search || ""}${location.hash || ""}`;
}

/** Sanitiza um destino: precisa começar com "/" e não pode apontar para /auth (loop). */
export function sanitizeRedirectTarget(target: unknown, fallback = "/"): string {
  if (typeof target !== "string" || target.length === 0) return fallback;
  if (!target.startsWith("/")) return fallback;
  // Evita loops para a própria página de auth ou /session-expired
  if (target.startsWith("/auth") || target.startsWith("/session-expired")) return fallback;
  return target;
}

/** Extrai o destino salvo no state da navegação (location.state.from). */
export function getRedirectFrom(state: unknown, fallback = "/"): string {
  if (!state || typeof state !== "object") return fallback;
  const from = (state as RedirectState).from;
  return sanitizeRedirectTarget(from, fallback);
}
