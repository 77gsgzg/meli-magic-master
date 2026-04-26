import { describe, it, expect, beforeEach } from "vitest";
import { logAuthEvent, getAuthEvents } from "@/lib/authTelemetry";

describe("authTelemetry", () => {
  beforeEach(() => {
    // limpa o buffer entre testes
    const events = getAuthEvents();
    events.length = 0;
    if (typeof window !== "undefined") {
      // @ts-expect-error reset for tests
      window.__authEvents = [];
    }
  });

  it("registra evento com timestamp ISO", () => {
    logAuthEvent("init_start");
    const events = getAuthEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("init_start");
    expect(() => new Date(events[0].at).toISOString()).not.toThrow();
  });

  it("inclui details quando fornecidos", () => {
    logAuthEvent("redirect_to_auth", { from: "/products?page=2", source: "ProtectedRoute" });
    const events = getAuthEvents();
    expect(events[0].details).toEqual({
      from: "/products?page=2",
      source: "ProtectedRoute",
    });
  });

  it("expõe buffer em window.__authEvents", () => {
    logAuthEvent("session_changed", { hasSession: true });
    // @ts-expect-error inspecting
    expect(window.__authEvents).toBeDefined();
    // @ts-expect-error inspecting
    expect(window.__authEvents.length).toBeGreaterThan(0);
  });

  it("limita o buffer a 50 eventos", () => {
    for (let i = 0; i < 60; i++) {
      logAuthEvent("session_changed", { i });
    }
    expect(getAuthEvents().length).toBe(50);
    // o primeiro evento foi descartado: começa em i=10
    expect(getAuthEvents()[0].details?.i).toBe(10);
  });
});
