import { useState, useEffect } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Users, BookOpen, Layers, FileText, Building2,
  CreditCard, MessageSquare, GraduationCap, Menu, LogOut, Settings, Tag, Package, Flag, HelpCircle, Star, BarChart3, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import BrandLogo from "@/components/BrandLogo";
import { brandMarkUrl } from "@/lib/brandAssets";
import { Button } from "@/components/ui/button";
import { isLocalMockAdminEnabled } from "@/lib/localDevAuth";

const allSidebarItems = [
  { path: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, group: "ওভারভিউ" },
  { path: "/admin/analytics", label: "এনালিটিক্স", icon: BarChart3, group: "ওভারভিউ" },

  { path: "/admin/classes", label: "শ্রেণী", icon: GraduationCap, group: "একাডেমিক ম্যানেজমেন্ট" },
  { path: "/admin/subjects", label: "বিষয়", icon: BookOpen, group: "একাডেমিক ম্যানেজমেন্ট" },
  { path: "/admin/chapters", label: "অধ্যায়", icon: Layers, group: "একাডেমিক ম্যানেজমেন্ট" },
  { path: "/admin/questions", label: "প্রশ্ন", icon: FileText, group: "একাডেমিক ম্যানেজমেন্ট" },
  { path: "/admin/topics", label: "টপিক", icon: Layers, group: "একাডেমিক ম্যানেজমেন্ট" },

  { path: "/admin/announcements", label: "অ্যানাউন্সমেন্ট", icon: MessageSquare, group: "কন্টেন্ট ম্যানেজমেন্ট" },
  { path: "/admin/homepage-video", label: "হোমপেজ ভিডিও", icon: HelpCircle, group: "কন্টেন্ট ম্যানেজমেন্ট" },
  { path: "/admin/reviews", label: "রিভিউ", icon: Star, group: "কন্টেন্ট ম্যানেজমেন্ট" },
  { path: "/admin/coupons", label: "কুপন", icon: Tag, group: "কন্টেন্ট ম্যানেজমেন্ট" },
  { path: "/admin/packages", label: "প্যাকেজ", icon: Package, group: "কন্টেন্ট ম্যানেজমেন্ট" },

  { path: "/admin/question-reports", label: "প্রশ্নের রিপোর্ট", icon: Flag, group: "রিপোর্ট ম্যানেজমেন্ট" },
  { path: "/admin/feedback", label: "মতামত", icon: MessageSquare, group: "রিপোর্ট ম্যানেজমেন্ট" },

  { path: "/admin/teachers", label: "শিক্ষক", icon: Users, group: "ইউজার ম্যানেজমেন্ট" },
  { path: "/admin/institutes", label: "প্রতিষ্ঠান", icon: Building2, group: "ইউজার ম্যানেজমেন্ট" },
  { path: "/admin/subscriptions", label: "সাবস্ক্রিপশন ও পেমেন্ট", icon: CreditCard, group: "ইউজার ম্যানেজমেন্ট" },

  { path: "/admin/advanced", label: "সেটিংস", icon: Settings, group: "সেটিংস", developerOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const localMockAdmin = isLocalMockAdminEnabled();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(localMockAdmin ? true : null);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null);
  const [adminHiddenPages, setAdminHiddenPages] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("admin_sidebar_collapsed") === "1";
  });
  useEffect(() => {
    localStorage.setItem("admin_sidebar_collapsed", desktopCollapsed ? "1" : "0");
  }, [desktopCollapsed]);
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    if (localMockAdmin) {
      setIsAdmin(true);
      setAllowedPages(null);
      setAdminHiddenPages([]);
      return;
    }
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
  }, [user, localMockAdmin]);

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
  
  // Check if route is hidden for non-developers
  const isAdminPageHidden = !isDeveloper && adminHiddenPages.includes(currentPath);

  // Developer-only routes
  const isDeveloperOnlyRoute = allSidebarItems.some(
    (item) => (item as any).developerOnly && (currentPath === item.path || currentPath.startsWith(item.path + "/"))
  );
  if (isDeveloperOnlyRoute && !isDeveloper) return <Navigate to="/admin" replace />;

  if ((!isRouteAllowed && currentPath !== "/admin") || isAdminPageHidden) {
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
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Admin Dark Navy Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-[260px] bg-[#0A1E38] border-r border-[#152e52] flex flex-col transition-[transform,width,opacity] duration-300 ease-in-out lg:sticky lg:z-auto overflow-hidden text-white select-none shadow-2xl lg:shadow-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        desktopCollapsed
          ? "lg:w-0 lg:min-w-0 lg:translate-x-0 lg:opacity-0 lg:border-r-0 lg:pointer-events-none"
          : "lg:w-[260px] lg:translate-x-0 lg:opacity-100"
      )}>
        {/* Brand Header */}
        <div className="min-h-[86px] flex items-center justify-between px-3.5 py-3 border-b border-white/15 shrink-0 bg-[#07162b] shadow-sm">
          <Link to="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 min-w-0 group" title="হোম পেইজে যান">
            <img
              src={brandMarkUrl}
              alt="প্রশ্নল্যাব"
              className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-amber-400/50 group-hover:ring-[#F4C053] transition-all shadow-md"
            />
            <div className="flex flex-col min-w-0 leading-none">
              <BrandLogo size={40} className="[&_.text-brand-navy]:text-white font-bold drop-shadow-sm tracking-tight" />
              <span className="text-[13px] text-amber-300 font-semibold tracking-wide mt-1.5 leading-none">এডমিন কন্ট্রোল প্যানেল</span>
            </div>
          </Link>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1 shrink-0"
            aria-label="সাইডবার বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-2 text-white custom-sidebar-scrollbar [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
          {Object.entries(groups).map(([groupLabel, items]) => (
            <div key={groupLabel}>
              <p className="text-[13px] font-heading font-bold uppercase tracking-wider text-white px-2.5 pt-2 pb-1">{groupLabel}</p>
              <div className="space-y-1">
                {items.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[15px] font-semibold transition-all duration-150 leading-tight select-none",
                        active
                          ? "bg-[#C8D5E5] text-[#0A1E38] shadow-sm font-bold"
                          : "text-white hover:bg-white/10"
                      )}
                    >
                      <div
                        className={cn(
                          "w-[26px] h-[26px] rounded flex items-center justify-center shrink-0 border transition-colors",
                          active
                            ? "border-[#0A1E38]/40 text-[#0A1E38] bg-[#0A1E38]/10"
                            : "border-white/40 text-white bg-white/5 group-hover:border-white"
                        )}
                      >
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Return to Teacher Dashboard */}
        <div className="p-2.5 pt-1.5 border-t border-white/10 bg-[#07162b]/80">
          <Link
            to="/dashboard"
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-white/95 bg-[#0f2c54] hover:bg-[#153e77] border border-[#1e467d] transition-all shadow-sm"
          >
            ← শিক্ষক ড্যাশবোর্ডে ফিরুন
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {localMockAdmin && (
          <div className="bg-amber-100 text-amber-900 border-b border-amber-300 px-4 py-2 text-center text-sm font-semibold">
            লোকাল টেস্ট Admin — আসল admin session নয়; protected পরিবর্তন সংরক্ষণ হবে না
          </div>
        )}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            title="মেন্যু"
          >
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
