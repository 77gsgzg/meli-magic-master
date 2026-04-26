import { describe, it, expect } from "vitest";
import {
  buildFullPath,
  sanitizeRedirectTarget,
  getRedirectFrom,
} from "@/lib/authRedirect";

describe("authRedirect.buildFullPath", () => {
  it("monta path simples", () => {
    expect(buildFullPath({ pathname: "/products", search: "", hash: "" })).toBe("/products");
  });

  it("inclui search params", () => {
    expect(
      buildFullPath({ pathname: "/orders", search: "?status=paid&page=2", hash: "" }),
    ).toBe("/orders?status=paid&page=2");
  });

  it("inclui hash", () => {
    expect(
      buildFullPath({ pathname: "/settings", search: "", hash: "#integrations" }),
    ).toBe("/settings#integrations");
  });

  it("combina search + hash", () => {
    expect(
      buildFullPath({ pathname: "/admin", search: "?tab=users", hash: "#row-42" }),
    ).toBe("/admin?tab=users#row-42");
  });

  it("usa fallback '/' quando pathname vazio", () => {
    expect(buildFullPath({ pathname: "", search: "", hash: "" })).toBe("/");
  });
});

describe("authRedirect.sanitizeRedirectTarget", () => {
  it("aceita path absoluto", () => {
    expect(sanitizeRedirectTarget("/dashboard")).toBe("/dashboard");
  });

  it("rejeita strings vazias", () => {
    expect(sanitizeRedirectTarget("")).toBe("/");
    expect(sanitizeRedirectTarget(undefined)).toBe("/");
    expect(sanitizeRedirectTarget(null)).toBe("/");
  });

  it("rejeita URLs externas", () => {
    expect(sanitizeRedirectTarget("https://evil.com")).toBe("/");
    expect(sanitizeRedirectTarget("//evil.com")).toBe("/"); // não começa com '/' único + path válido controlado
  });

  it("evita loop em /auth e /session-expired", () => {
    expect(sanitizeRedirectTarget("/auth")).toBe("/");
    expect(sanitizeRedirectTarget("/auth?x=1")).toBe("/");
    expect(sanitizeRedirectTarget("/session-expired")).toBe("/");
  });

  it("respeita fallback customizado", () => {
    expect(sanitizeRedirectTarget("", "/home")).toBe("/home");
  });
});

describe("authRedirect.getRedirectFrom", () => {
  it("extrai 'from' do state quando presente", () => {
    expect(getRedirectFrom({ from: "/orders?page=3#top" })).toBe("/orders?page=3#top");
  });

  it("retorna fallback quando state ausente/inválido", () => {
    expect(getRedirectFrom(null)).toBe("/");
    expect(getRedirectFrom(undefined)).toBe("/");
    expect(getRedirectFrom({})).toBe("/");
    expect(getRedirectFrom({ from: 42 })).toBe("/");
  });

  it("sanitiza destinos perigosos", () => {
    expect(getRedirectFrom({ from: "/auth" })).toBe("/");
    expect(getRedirectFrom({ from: "https://evil.com" })).toBe("/");
  });
});
