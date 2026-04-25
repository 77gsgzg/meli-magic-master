import { toast } from "sonner";

/**
 * Padroniza tratamento de erros de chamadas à edge function `admin-manage`.
 * O backend retorna `{ error, code }` (ex.: code = "forbidden", "unauthorized",
 * "invalid_params", "user_not_found"). Os clientes Supabase também podem
 * embrulhar a resposta em `error.context` ou `error.message`.
 */
export type AdminErrorCode =
  | "forbidden"
  | "unauthorized"
  | "invalid_params"
  | "user_not_found"
  | "unknown";

export interface NormalizedAdminError {
  code: AdminErrorCode;
  message: string;
  status?: number;
}

const messages: Record<AdminErrorCode, string> = {
  forbidden: "Você não tem permissão para executar esta ação.",
  unauthorized: "Sessão expirada. Faça login novamente.",
  invalid_params: "Parâmetros inválidos para esta operação.",
  user_not_found: "Usuário não encontrado.",
  unknown: "Falha inesperada. Tente novamente.",
};

const suggestedActions: Record<AdminErrorCode, string> = {
  forbidden: "Confirme com um administrador se você possui o papel necessário.",
  unauthorized: "Saia da conta e entre novamente para renovar a sessão.",
  invalid_params: "Revise os campos preenchidos antes de tentar novamente.",
  user_not_found: "Atualize a lista — o usuário pode ter sido removido.",
  unknown: "Aguarde alguns segundos e tente novamente. Se persistir, contate o suporte.",
};

export function normalizeAdminError(
  err: unknown,
  data?: any,
): NormalizedAdminError {
  // The Supabase functions client returns { data, error } where error is a
  // FunctionsHttpError with `context.json()` or status. We try to read the
  // structured payload first.
  let code: AdminErrorCode = "unknown";
  let message = "";
  let status: number | undefined;

  if (data && typeof data === "object" && "code" in data) {
    code = (data.code as AdminErrorCode) ?? "unknown";
    message = (data.error as string) ?? "";
  }

  if (err && typeof err === "object") {
    const anyErr = err as any;
    status = anyErr.status ?? anyErr.context?.status;
    if (!message) message = anyErr.message ?? "";
    if (status === 401) code = "unauthorized";
    else if (status === 403) code = "forbidden";
    else if (status === 404) code = "user_not_found";
    else if (status === 400) code = "invalid_params";
  }

  return {
    code,
    status,
    message: message || messages[code] || messages.unknown,
  };
}

/** Toast helper used by admin screens to surface errors consistently. */
export function handleAdminError(
  err: unknown,
  fallbackTitle = "Operação falhou",
  data?: any,
): NormalizedAdminError {
  const e = normalizeAdminError(err, data);
  const friendly = messages[e.code] ?? messages.unknown;
  const action = suggestedActions[e.code] ?? suggestedActions.unknown;
  toast.error(fallbackTitle, {
    description: `[${e.code}] ${friendly} — ${action}`,
  });
  return e;
}

/** Returns the suggested next action string for a given code. */
export function getSuggestedAction(code: AdminErrorCode): string {
  return suggestedActions[code] ?? suggestedActions.unknown;
}
