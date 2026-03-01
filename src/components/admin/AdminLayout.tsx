import { useState, useEffect } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Users, BookOpen, Layers, FileText, Building2,
  CreditCard, MessageSquare, GraduationCap, Menu, LogOut, Settings, Tag, Package, Flag, HelpCircle, Star, ClipboardList, Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import logoImg from "@/assets/logo.png";
import { Button } from "@/components/ui/button";

const allSidebarItems = [
  { path: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, group: "ওভারভিউ" },

  { path: "/admin/classes", label: "শ্রেণী", icon: GraduationCap, group: "একাডেমিক ম্যানেজমেন্ট" },
  { path: "/admin/subjects", label: "বিষয়", icon: BookOpen, group: "একাডেমিক ম্যানেজমেন্ট" },
  { path: "/admin/chapters", label: "অধ্যায়", icon: Layers, group: "একাডেমিক ম্যানেজমেন্ট" },
  { path: "/admin/questions", label: "প্রশ্ন", icon: FileText, group: "একাডেমিক ম্যানেজমেন্ট" },
  { path: "/admin/topics", label: "টপিক", icon: Layers, group: "একাডেমিক ম্যানেজমেন্ট" },
  

  { path: "/admin/announcements", label: "অ্যানাউন্সমেন্ট", icon: MessageSquare, group: "কন্টেন্ট ম্যানেজমেন্ট" },
  { path: "/admin/faqs", label: "FAQ", icon: HelpCircle, group: "কন্টেন্ট ম্যানেজমেন্ট" },
  { path: "/admin/reviews", label: "রিভিউ", icon: Star, group: "কন্টেন্ট ম্যানেজমেন্ট" },
  { path: "/admin/coupons", label: "কুপন", icon: Tag, group: "কন্টেন্ট ম্যানেজমেন্ট" },
  { path: "/admin/packages", label: "প্যাকেজ", icon: Package, group: "কন্টেন্ট ম্যানেজমেন্ট" },

  { path: "/admin/question-reports", label: "প্রশ্নের রিপোর্ট", icon: Flag, group: "রিপোর্ট ম্যানেজমেন্ট" },
  { path: "/admin/feedback", label: "মতামত", icon: MessageSquare, group: "রিপোর্ট ম্যানেজমেন্ট" },

  { path: "/admin/teachers", label: "শিক্ষক", icon: Users, group: "ইউজার ম্যানেজমেন্ট" },
  { path: "/admin/institutes", label: "প্রতিষ্ঠান", icon: Building2, group: "ইউজার ম্যানেজমেন্ট" },
  { path: "/admin/subscriptions", label: "সাবস্ক্রিপশন", icon: CreditCard, group: "ইউজার ম্যানেজমেন্ট" },
  { path: "/admin/purchases", label: "পারচেজ রিকুয়েস্ট", icon: CreditCard, group: "ইউজার ম্যানেজমেন্ট" },

  { path: "/admin/advanced", label: "অ্যাডভান্সড", icon: Wrench, group: "ডেভেলপার", developerOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null);
  const [adminHiddenPages, setAdminHiddenPages] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
    supabase.rpc("has_role", { _user_id: user.id, _role: "developer" })
      .then(({ data }) => setIsDeveloper(!!data));
    
    supabase.from("user_roles").select("allowed_pages").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => {
        setAllowedPages((data as any)?.allowed_pages || null);
      });

    // Fetch admin hidden pages
    supabase.from("app_settings").select("value").eq("key", "admin_hidden_pages").maybeSingle()
      .then(({ data }) => {
        const hidden = data?.value;
        setAdminHiddenPages(Array.isArray(hidden) ? (hidden as string[]) : []);
      });

    // Real-time listener for admin hidden pages
    const channel = supabase.channel("admin_hidden_pages_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings", filter: "key=eq.admin_hidden_pages" }, (payload: any) => {
        const hidden = payload.new?.value;
        setAdminHiddenPages(Array.isArray(hidden) ? (hidden as string[]) : []);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading || isAdmin === null) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  // Filter sidebar items based on allowed_pages, developer role, and admin hidden pages
  const visibleItems = (allowedPages
    ? allSidebarItems.filter(item => allowedPages.includes(item.path))
    : allSidebarItems
  )
    .filter(item => !(item as any).developerOnly || isDeveloper)
    .filter(item => isDeveloper || !adminHiddenPages.includes(item.path));

  // Check if current route is allowed
  const currentPath = location.pathname;
  const isRouteAllowed = !allowedPages || allowedPages.some(p => currentPath === p || currentPath.startsWith(p + "/"));
  
  if (!isRouteAllowed && currentPath !== "/admin") {
    // Redirect to first allowed page
    const firstAllowed = allowedPages?.[0] || "/admin";
    return <Navigate to={firstAllowed} replace />;
  }

  // Group visible items
  const groups: Record<string, typeof allSidebarItems> = {};
  visibleItems.forEach(item => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });

  const fullName = user.user_metadata?.full_name || "Admin";

  return (
    <div className="min-h-screen flex bg-background font-body">
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-[240px] bg-card border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:sticky lg:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Link to="/" className="h-16 flex items-center gap-2.5 px-4 border-b border-border shrink-0 hover:bg-muted/50 transition-colors">
          <img src={logoImg} alt="eExamapp" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-heading font-bold text-lg text-foreground">Admin Panel</span>
        </Link>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {Object.entries(groups).map(([groupLabel, items]) => (
            <div key={groupLabel}>
              <p className="text-[11px] font-heading font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">{groupLabel}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
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
