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
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile/tablet */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      {/* Main Content */}
      <div className="lg:pl-64 transition-all duration-300 flex flex-col min-h-screen">
        <Header title={title} subtitle={subtitle} />
        
        {/* Main content area - mobile-first padding */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6 xl:p-8">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}