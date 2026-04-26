import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// --- Mocks ---------------------------------------------------------------
// Controla o estado da sessão "armazenada" e dispara eventos para testes.
type Listener = (event: string, session: unknown) => void;
const listeners: Listener[] = [];
let storedSession: { user: { id: string; email: string } } | null = null;
let getSessionDelay = 0;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: Listener) => {
        listeners.push(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const i = listeners.indexOf(cb);
                if (i >= 0) listeners.splice(i, 1);
              },
            },
          },
        };
      },
      getSession: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: { session: storedSession } }), getSessionDelay);
        }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// useIsAdmin mock simples — não-admin por padrão.
vi.mock("@/hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ isAdmin: false, loading: false }),
}));

// Sonner toast mock para silenciar e evitar render colateral.
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

// --- Imports após mocks --------------------------------------------------
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

beforeEach(() => {
  listeners.length = 0;
  storedSession = null;
  getSessionDelay = 0;
});

function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route
            path="/auth"
            element={<div data-testid="auth-page">AUTH</div>}
          />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div data-testid="private">PRIVATE</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <div data-testid="orders">ORDERS</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("não redireciona enquanto a sessão ainda não foi inicializada (mostra loader)", async () => {
    // simula latência de getSession
    getSessionDelay = 50;
    storedSession = { user: { id: "u-1", email: "x@y.com" } };

    renderApp(["/protected"]);

    // antes de getSession resolver, NÃO deve estar em /auth nem mostrar conteúdo privado
    expect(screen.queryByTestId("auth-page")).toBeNull();
    expect(screen.queryByTestId("private")).toBeNull();
    expect(screen.getByText(/carregando sessão/i)).toBeInTheDocument();

    // após resolver, conteúdo privado deve aparecer (sessão persistida)
    await waitFor(() => {
      expect(screen.getByTestId("private")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("auth-page")).toBeNull();
  });

  it("persiste login após 'reload': sessão no storage => entra direto na rota privada", async () => {
    storedSession = { user: { id: "u-42", email: "a@b.com" } };

    renderApp(["/protected"]);

    await waitFor(() => {
      expect(screen.getByTestId("private")).toBeInTheDocument();
    });
  });

  it("redireciona para /auth quando NÃO há sessão (após init), preservando destino com query/hash", async () => {
    storedSession = null;

    renderApp(["/orders?status=paid#row-9"]);

    await waitFor(() => {
      expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    });
    // o conteúdo privado nunca deve ter renderizado
    expect(screen.queryByTestId("orders")).toBeNull();
  });
});
