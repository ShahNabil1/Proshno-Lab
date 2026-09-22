import { useState, useEffect } from "react";
import { Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, PlusSquare, Tv, Database,
  FileText, GraduationCap, Building2, CreditCard,
  PlayCircle, Grid, KeyRound, CheckCircle2,
  PhoneCall, MessageSquare, Menu, LogOut, User, Shield, Home, Award, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isLocalMockAdminEnabled } from "@/lib/localDevAuth";

import BrandLogo from "@/components/BrandLogo";
import { brandMarkUrl } from "@/lib/brandAssets";
import { Button } from "@/components/ui/button";
import OnboardingModal from "@/components/OnboardingModal";
import AnnouncementBar from "@/components/dashboard/AnnouncementBar";
import { useCloudBackup } from "@/hooks/useCloudBackup";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CONFIRM_LEAVE_PATHS = ["/dashboard/view-paper", "/dashboard/create", "/dashboard/auto-create"];

const baseSidebarGroups = [
  {
    label: "সার্বিক চিত্র",
    items: [
      { path: "/dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
      { path: "/dashboard/create", label: "প্রশ্ন তৈরি", icon: PlusSquare },
      { path: "/dashboard/smartboard", label: "স্মার্টবোর্ড", icon: Tv },
      { path: "/dashboard/packages", label: "প্রশ্নব্যাংক", icon: Database },
    ],
  },
  {
    label: "ব্যবস্থাপনা",
    items: [
      { path: "/dashboard/my-questions", label: "আমার তৈরি প্রশ্ন", icon: FileText, requiresCloudBackup: true },
      { path: "/dashboard/students", label: "শিক্ষার্থী", icon: GraduationCap },
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
    label: "OMR সংক্রান্ত",
    items: [
      { path: "/dashboard/omr-tutorial", label: "OMR টিউটোরিয়াল", icon: PlayCircle },
      { path: "/dashboard/omr-create", label: "OMR তৈরি", icon: Grid },
      { path: "/dashboard/omr-tokens", label: "OMR টোকেন", icon: KeyRound },
      { path: "/dashboard/omr-evaluation", label: "OMR মূল্যায়ন", icon: CheckCircle2 },
    ],
  },
  {
    label: "হেল্প লাইন",
    items: [
      { path: "/dashboard/contact", label: "যোগাযোগ", icon: PhoneCall },
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
  const localMockAdmin = isLocalMockAdminEnabled();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("dashboard_sidebar_collapsed") === "1";
  });
  useEffect(() => {
    localStorage.setItem("dashboard_sidebar_collapsed", desktopCollapsed ? "1" : "0");
  }, [desktopCollapsed]);
  const [isAdmin, setIsAdmin] = useState(localMockAdmin);
  const [hasInstitute, setHasInstitute] = useState<boolean | null>(localMockAdmin ? true : null);
  const [isBanned, setIsBanned] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { cloudBackupEnabled } = useCloudBackup();
  const hiddenPages = useDashboardHiddenPages();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const needsLeaveConfirm = CONFIRM_LEAVE_PATHS.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (location.pathname.startsWith("/dashboard/view-paper")) {
      setDesktopCollapsed(false);
    }
  }, [location.pathname]);

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
    if (localMockAdmin) {
      setIsAdmin(true);
      setHasInstitute(true);
      setIsBanned(false);
      return;
    }

    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
    
    supabase.from("institutes").select("id").eq("owner_id", user.id).maybeSingle()
      .then(({ data }) => setHasInstitute(!!data));
    
    supabase.from("teachers").select("is_banned").eq("id", user.id).maybeSingle()
      .then(({ data }) => setIsBanned(!!(data as any)?.is_banned));
  }, [user, localMockAdmin]);

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
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ProshnoLab Left Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-[260px] bg-[#0A1E38] border-r border-[#152e52] flex flex-col transition-[transform,width,opacity] duration-300 ease-in-out lg:sticky lg:z-auto overflow-hidden shadow-2xl lg:shadow-none text-white select-none shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        desktopCollapsed
          ? "lg:w-0 lg:min-w-0 lg:translate-x-0 lg:opacity-0 lg:border-r-0 lg:pointer-events-none"
          : "lg:w-[260px] lg:translate-x-0 lg:opacity-100"
      )}>
        {/* Brand Logo Header */}
        <div className="min-h-[86px] flex items-center justify-between px-3.5 py-3 border-b border-white/15 shrink-0 bg-[#07162b] shadow-sm">
          <Link
            to="/"
            onClick={(e) => {
              if (needsLeaveConfirm) {
                e.preventDefault();
                setConfirmLeave(true);
              }
              setSidebarOpen(false);
            }}
            className="flex items-center gap-3 min-w-0 group"
            title="হোম পেইজে যান"
          >
            <img
              src={brandMarkUrl}
              alt="প্রশ্নল্যাব"
              className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-amber-400/50 group-hover:ring-[#F4C053] transition-all shadow-md"
            />
            <div className="flex flex-col min-w-0 leading-none">
              <BrandLogo size={40} className="[&_.text-brand-navy]:text-white font-bold drop-shadow-sm tracking-tight" />
              <span className="text-[13px] text-amber-300 font-semibold tracking-wide mt-1.5 leading-none">
                স্মার্ট প্রশ্নব্যাংক প্ল্যাটফর্ম
              </span>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1 shrink-0"
            aria-label="সাইডবার বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-2 text-white custom-sidebar-scrollbar [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
          {sidebarGroups.map((group, gIdx) => (
            <div key={group.label || gIdx}>
              {group.label ? (
                <p className="text-[13px] font-heading font-bold tracking-wide text-white px-2.5 pt-2 pb-1">
                  {group.label}
                </p>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => {
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

        {/* Affiliate Program Button */}
        <div className="p-2.5 pt-1.5 shrink-0 border-t border-white/10 bg-[#07162b]/80 space-y-1.5">
          <Link
            to="/dashboard/affiliate"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-center transition-all duration-150 shadow-sm border",
              location.pathname === "/dashboard/affiliate"
                ? "bg-[#C8D5E5] text-[#0A1E38] border-transparent font-bold"
                : "bg-[#0f2c54] hover:bg-[#153e77] text-white border-[#1e467d] hover:border-amber-400/60"
            )}
          >
            <Award className="w-3.5 h-3.5 text-[#F4C053] shrink-0" />
            <span className="truncate">প্রশ্নল্যাব এফিলিয়েট প্রোগ্রাম</span>
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-amber-300 hover:bg-amber-400/10 border border-amber-400/20 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" /> এডমিন প্যানেল
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile-only menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              title="মেন্যু"
            >
              <Menu className="w-5 h-5" />
            </Button>
            {/* Desktop collapse toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-muted-foreground hover:text-foreground"
              onClick={() => setDesktopCollapsed(v => !v)}
              title={desktopCollapsed ? "সাইডবার খুলুন" : "সাইডবার বন্ধ করুন"}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
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

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:overflow-visible">
          {children}
        </main>
      </div>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>হোম পেইজে যেতে চান?</AlertDialogTitle>
            <AlertDialogDescription>
              এই পেইজ থেকে বের হলে বর্তমান কাজ/নির্বাচন হারিয়ে যেতে পারে। আপনি কি নিশ্চিতভাবে হোম পেইজে যেতে চান?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না, এখানেই থাকি</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/")}>হ্যাঁ, যান</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Onboarding modal - blocks dashboard until institute is registered */}
      <OnboardingModal
        open={!localMockAdmin && hasInstitute === false}
        onComplete={() => setHasInstitute(true)}
      />
    </div>
  );
}
