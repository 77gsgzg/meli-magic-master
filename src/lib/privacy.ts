/**
 * Utilitários de mascaramento de PII.
 * Por padrão, dados sensíveis são exibidos mascarados.
 * Use apenas quando o usuário clicar explicitamente em "revelar".
 */

export function maskEmail(email?: string | null): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***-***-${digits.slice(-4)}`;
}

export function maskName(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p, i) => (i === 0 ? p : `${p[0] ?? ""}***`))
    .join(" ");
}

export function maskDocument(doc?: string | null): string {
  if (!doc) return "—";
  const digits = doc.replace(/\D/g, "");
  if (digits.length <= 4) return "***";
  return `***.***.***-${digits.slice(-2)}`;
}

export function maskAddress(addr?: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}••• [protegido]`;
}

export function maskZip(zip?: string | null): string {
  if (!zip) return "—";
  const digits = zip.replace(/\D/g, "");
  if (digits.length < 3) return "***";
  return `${digits.slice(0, 2)}***-***`;
}

/** Sanitiza objetos para logs — remove ou mascara campos sensíveis. */
const SENSITIVE_KEYS = [
  "email",
  "password",
  "buyer_email",
  "buyer_phone",
  "buyer_document_number",
  "buyer_first_name",
  "buyer_last_name",
  "shipping_address_line",
  "shipping_address_zip_code",
  "shipping_receiver_name",
  "access_token",
  "refresh_token",
];

export function sanitizeForLog<T>(data: T): T {
  if (data == null || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeForLog) as unknown as T;
  const out: any = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.includes(k)) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object") {
      out[k] = sanitizeForLog(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
