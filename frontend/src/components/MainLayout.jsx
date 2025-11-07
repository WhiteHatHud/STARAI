import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useStore from "../store";

// Simple icon components (temporary until lucide-react is installed)
const Home = ({ className, size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const FileText = ({ className, size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const Users = ({ className, size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const HelpCircle = ({ className, size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const LogOut = ({ className, size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const Menu = ({ className, size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const X = ({ className, size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// Simple button component (replace with shadcn/ui later)
const Button = ({ variant = "default", size = "default", onClick, className = "", children }) => {
  const baseStyles = "transition-all duration-200 rounded-lg font-medium";
  const variantStyles = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  };
  const sizeStyles = {
    default: "px-4 py-2",
    sm: "px-3 py-1.5 text-sm",
    lg: "px-6 py-3 text-lg",
    icon: "p-2",
  };

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant] || variantStyles.default} ${sizeStyles[size] || sizeStyles.default} ${className}`}
    >
      {children}
    </button>
  );
};

const MainLayout = ({ children, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Check if user is admin
  const isAdmin = user?.is_admin || user?.role === "admin" || false;

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
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

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar - Desktop */}
      <aside
        className={`hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
          collapsed ? "w-20" : "w-[280px]"
        }`}
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
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-lg transition-all duration-200 ${
                  isActive(item.key)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon size={24} className="shrink-0" />
                {!collapsed && <span className="text-lg font-medium">{item.label}</span>}
              </button>
            );
          })}
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
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      navigate(item.key);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-lg transition-all duration-200 ${
                      isActive(item.key)
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <Icon size={24} />
                    <span className="text-lg font-medium">{item.label}</span>
                  </button>
                );
              })}
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
