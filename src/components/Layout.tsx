import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border px-4 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary">
                v1.0.0
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="status-dot-active" />
                <span className="text-xs font-mono text-muted-foreground">Paper Mode</span>
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                EURUSD · H1
              </Badge>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
