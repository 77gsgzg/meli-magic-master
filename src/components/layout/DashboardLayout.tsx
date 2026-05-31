import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background ambient-backdrop overflow-x-hidden">
      {/* Cinematic grid + vignette */}
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, hsl(var(--primary) / 0.08), transparent 60%)",
        }}
      />

      {/* Desktop Sidebar - hidden on mobile/tablet */}
      <div className="hidden lg:block relative z-40">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="lg:pl-64 transition-all duration-300 flex flex-col min-h-screen relative z-10">
        <Header title={title} subtitle={subtitle} />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 xl:p-8">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
