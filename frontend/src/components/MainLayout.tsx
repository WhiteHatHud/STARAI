import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  FileText,
  Users,
  HelpCircle,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import useStore from "@/store";

interface MainLayoutProps {
  children: ReactNode;
  isAdmin?: boolean;
}

const MainLayout = ({ children, isAdmin = false }: MainLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    });
    navigate("/login");
  };

  const menuItems = [
    {
      key: "/home",
      icon: Home,
      label: "Homepage",
    },
    ...(isAdmin
      ? [
          {
            key: "/admin",
            icon: Users,
            label: "User Management",
          },
        ]
      : []),
    {
      key: "/reports/dashboard",
      icon: FileText,
      label: "Reports Dashboard",
    },
    {
      key: "/instructions",
      icon: HelpCircle,
      label: "Instructions",
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-20" : "w-[280px]"
        )}
      >
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          {!collapsed && (
            <h2 className="text-lg font-bold text-sidebar-foreground">
              Detection Platform
            </h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <Menu size={24} /> : <X size={24} />}
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-4 rounded-lg transition-all duration-200",
                isActive(item.key)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon size={24} className="shrink-0" />
              {!collapsed && <span className="text-lg font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-lg text-danger hover:bg-danger/10 transition-all duration-200"
          >
            <LogOut size={24} className="shrink-0" />
            {!collapsed && <span className="text-lg font-medium">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-[280px] bg-sidebar border-r border-sidebar-border z-50 md:hidden flex flex-col">
            <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-sidebar-foreground">
                Detection Platform
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="text-sidebar-foreground"
              >
                <X size={24} />
              </Button>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    navigate(item.key);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-4 rounded-lg transition-all duration-200",
                    isActive(item.key)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon size={24} />
                  <span className="text-lg font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-sidebar-border">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-lg text-danger hover:bg-danger/10 transition-all duration-200"
              >
                <LogOut size={24} />
                <span className="text-lg font-medium">Log Out</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={24} />
          </Button>
          <h1 className="text-lg font-bold">Detection Platform</h1>
          <div className="w-10" /> {/* Spacer */}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default MainLayout;
