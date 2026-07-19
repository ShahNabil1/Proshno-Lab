import { useState, useEffect } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard, PlusCircle, BookOpen, Package, FileText,
  Building2, CreditCard, MessageSquare, Phone, Menu, LogOut, User, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import logoImg from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import OnboardingModal from "@/components/OnboardingModal";
import AnnouncementBar from "@/components/dashboard/AnnouncementBar";
import { useCloudBackup } from "@/hooks/useCloudBackup";

const baseSidebarGroups = [
  {
    label: "সার্বিক চিত্র",
    items: [
      { path: "/dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
      { path: "/dashboard/create", label: "১ ক্লিকে প্রশ্ন তৈরি", icon: PlusCircle },
    ],
  },
  {
    label: "প্যাকেজ",
    items: [
      { path: "/dashboard/packages", label: "রেডি প্রশ্ন/সাজেশন", icon: Package },
    ],
  },
  {
    label: "ব্যবস্থাপনা",
    items: [
      { path: "/dashboard/my-questions", label: "আমার তৈরি প্রশ্ন", icon: FileText, requiresCloudBackup: true },
    ],
  },
  {
    label: "প্রতিষ্ঠান সংক্রান্ত",
    items: [
      { path: "/dashboard/institute", label: "আমার প্রতিষ্ঠান", icon: Building2 },
      { path: "/dashboard/subscription", label: "আমার সাবস্ক্রিপশন", icon: CreditCard },
    ],
  },
  {
    label: "হেল্প লাইন",
    items: [
      { path: "/dashboard/contact", label: "যোগাযোগ", icon: Phone },
      { path: "/dashboard/feedback", label: "মতামত", icon: MessageSquare },
    ],
  },
];

function useDashboardHiddenPages() {
  const [hiddenPages, setHiddenPages] = useState<string[]>([]);
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "dashboard_hidden_pages").maybeSingle()
      .then(({ data }) => {
        const val = data?.value;
        if (Array.isArray(val)) setHiddenPages(val as string[]);
      });

    const channel = supabase
      .channel("dashboard_hidden_pages_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings", filter: "key=eq.dashboard_hidden_pages" }, (payload) => {
        const val = (payload.new as any)?.value;
        if (Array.isArray(val)) setHiddenPages(val as string[]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
  return hiddenPages;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasInstitute, setHasInstitute] = useState<boolean | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const location = useLocation();
  const { cloudBackupEnabled } = useCloudBackup();
  const hiddenPages = useDashboardHiddenPages();

  // Filter sidebar based on cloud backup setting AND hidden pages
  const sidebarGroups = baseSidebarGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if ((item as any).requiresCloudBackup && !cloudBackupEnabled) return false;
        if (hiddenPages.includes(item.path)) return false;
        return true;
      }),
    }))
    .filter(group => group.items.length > 0);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
    
    supabase.from("institutes").select("id").eq("owner_id", user.id).maybeSingle()
      .then(({ data }) => setHasInstitute(!!data));
    
    supabase.from("teachers").select("is_banned").eq("id", user.id).maybeSingle()
      .then(({ data }) => setIsBanned(!!(data as any)?.is_banned));
  }, [user]);

  // Redirect if current page is hidden
  const currentPath = location.pathname;
  const isPageHidden = hiddenPages.length > 0 && hiddenPages.includes(currentPath);
  const redirectPath = isPageHidden && currentPath === "/dashboard" ? "/login" : "/dashboard";
  
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isPageHidden) return <Navigate to={redirectPath} replace />;
  if (isBanned) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">অ্যাকাউন্ট স্থগিত</h1>
        <p className="text-muted-foreground">আপনার অ্যাকাউন্ট এ্যাডমিন দ্বারা ব্যান করা হয়েছে। বিস্তারিত জানতে যোগাযোগ করুন।</p>
        <Button onClick={signOut} variant="outline">লগআউট</Button>
      </div>
    </div>
  );

  const avatarUrl = user.user_metadata?.avatar_url;
  const fullName = user.user_metadata?.full_name || "ব্যবহারকারী";

  return (
    <div className="min-h-screen flex bg-background font-body relative">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-[220px] bg-card border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:sticky lg:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Link to="/" className="h-16 flex items-center gap-2.5 px-4 border-b border-border shrink-0 hover:bg-muted/50 transition-colors">
          <img src={logoImg} alt="Proshno Lab" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-heading font-bold text-lg text-foreground">
            Proshno<span className="text-gradient-green"> Lab</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {sidebarGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-heading font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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

        {isAdmin && (
          <div className="p-3 border-t border-border">
            <Link to="/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10">
              <Shield className="w-4 h-4" /> Admin Panel
            </Link>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <Link to="/dashboard/institute" className="flex items-center gap-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20" />
              ) : (
                <div className="w-8 h-8 rounded-full gradient-green flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </Link>
            <Button variant="ghost" size="icon" onClick={signOut} title="লগআউট">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <AnnouncementBar />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:overflow-visible">{children}</main>
      </div>

      {/* Onboarding modal - blocks dashboard until institute is registered */}
      <OnboardingModal
        open={hasInstitute === false}
        onComplete={() => setHasInstitute(true)}
      />
    </div>
  );
}
