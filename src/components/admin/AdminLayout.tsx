import { useState, useEffect } from "react";
import { Link, useLocation, Navigate, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, BookOpen, Layers, FileText, Building2,
  CreditCard, MessageSquare, GraduationCap, Menu, LogOut, User, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import logoImg from "@/assets/logo.png";
import { Button } from "@/components/ui/button";

const sidebarGroups = [
  {
    label: "ওভারভিউ",
    items: [
      { path: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
    ],
  },
  {
    label: "একাডেমিক ম্যানেজমেন্ট",
    items: [
      { path: "/admin/classes", label: "শ্রেণী", icon: GraduationCap },
      { path: "/admin/subjects", label: "বিষয়", icon: BookOpen },
      { path: "/admin/chapters", label: "অধ্যায়", icon: Layers },
      { path: "/admin/categories", label: "প্রশ্নের ক্যাটাগরি", icon: Settings },
    ],
  },
  {
    label: "কন্টেন্ট ম্যানেজমেন্ট",
    items: [
      { path: "/admin/questions", label: "প্রশ্ন", icon: FileText },
    ],
  },
  {
    label: "ইউজার ম্যানেজমেন্ট",
    items: [
      { path: "/admin/teachers", label: "শিক্ষক", icon: Users },
      { path: "/admin/institutes", label: "প্রতিষ্ঠান", icon: Building2 },
      { path: "/admin/subscriptions", label: "সাবস্ক্রিপশন", icon: CreditCard },
      { path: "/admin/feedback", label: "মতামত", icon: MessageSquare },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (loading || isAdmin === null) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const fullName = user.user_metadata?.full_name || "Admin";

  return (
    <div className="min-h-screen flex bg-background font-body">
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-[240px] bg-card border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center gap-2.5 px-4 border-b border-border shrink-0">
          <img src={logoImg} alt="eExamapp" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-heading font-bold text-lg text-foreground">Admin Panel</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {sidebarGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-heading font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                      className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}>
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">
            ← Teacher Dashboard
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">{fullName}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="লগআউট">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
