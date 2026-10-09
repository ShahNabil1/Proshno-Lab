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

import BrandLockup from "@/components/BrandLockup";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import OnboardingModal from "@/components/OnboardingModal";
import AnnouncementBar from "@/components/dashboard/AnnouncementBar";
import { useCloudBackup } from "@/hooks/useCloudBackup";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CONFIRM_LEAVE_PATHS = ["/dashboard/view-paper", "/dashboard/create", "/dashboard/auto-create"];

const baseSidebarGroups = [
  { label: "", items: [
    { path: "/dashboard", label: "এক নজরে", icon: LayoutDashboard },
    { path: "/dashboard/my-questions", label: "আমার প্রশ্নপত্র", icon: FileText },
    { path: "/dashboard/packages", label: "প্রশ্নভান্ডার", icon: Database },
    { path: "/dashboard/smartboard", label: "স্মার্টবোর্ড", icon: Tv },
  ] },
  { label: "পরীক্ষা ও ফলাফল", items: [
    { path: "/dashboard/students", label: "শিক্ষার্থী", icon: GraduationCap },
  ] },
  { label: "OMR সরঞ্জাম", items: [
    { path: "/dashboard/omr-create", label: "শিট তৈরি", icon: Grid },
    { path: "/dashboard/omr-evaluation", label: "মূল্যায়ন", icon: CheckCircle2 },
    { path: "/dashboard/omr-tokens", label: "টোকেন", icon: KeyRound },
    { path: "/dashboard/omr-tutorial", label: "ব্যবহার শিখুন", icon: PlayCircle },
  ] },
  { label: "প্রতিষ্ঠান ও অ্যাকাউন্ট", items: [
    { path: "/dashboard/institute", label: "প্রতিষ্ঠান", icon: Building2 },
    { path: "/dashboard/subscription", label: "সাবস্ক্রিপশন", icon: CreditCard },
  ] },
  { label: "সহায়তা", items: [
    { path: "/dashboard/contact", label: "যোগাযোগ", icon: PhoneCall },
    { path: "/dashboard/feedback", label: "মতামত", icon: MessageSquare },
  ] },
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

    supabase.from("institutes").select("id").eq("owner_id", user.id).order("id", { ascending: true }).limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Institute lookup failed:", error);
          return;
        }
        setHasInstitute(!!data);
      });

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
    <div className="min-h-screen flex bg-white font-body relative">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ProshnoLab Left Sidebar */}
      <aside className={cn(
        "brand-sidebar fixed top-0 left-0 z-50 h-[100dvh] w-[234px] max-w-[calc(100vw-48px)] lg:max-w-none bg-[#0A1E38] border-r border-[#152e52] flex flex-col transition-[transform,width,opacity] duration-300 ease-in-out lg:sticky lg:z-auto overflow-hidden shadow-2xl lg:shadow-none text-white select-none shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        desktopCollapsed
          ? "lg:w-0 lg:min-w-0 lg:translate-x-0 lg:opacity-0 lg:border-r-0 lg:pointer-events-none"
          : "lg:w-[260px] lg:translate-x-0 lg:opacity-100"
      )}>
        {/* Brand Logo Header */}
        <div className="sidebar-brand-header min-h-[68px] lg:min-h-[86px] flex items-center justify-between px-3.5 py-3 border-b border-white/15 shrink-0 bg-[#07162b] shadow-sm">
          <Link
            to="/"
            onClick={(e) => {
              if (needsLeaveConfirm) {
                e.preventDefault();
                setConfirmLeave(true);
              }
              setSidebarOpen(false);
            }}
            className="sidebar-brand-link flex items-center gap-3 min-w-0 group"
            title="হোম পেইজে যান"
          >
            <BrandLockup size={48} />
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

        <nav aria-label="শিক্ষক কর্মক্ষেত্র" className="flex-1 overflow-y-auto px-3 py-3 space-y-3 lg:px-4 lg:py-4 lg:space-y-5 text-white" style={{ textRendering: "auto", fontFamily: "SolaimanLipi, Arial, sans-serif" }}>
          {!hiddenPages.includes("/dashboard/create") && <Link to="/dashboard/create" onClick={() => setSidebarOpen(false)} className="sidebar-create-cta flex items-center justify-between rounded-lg bg-[#00B4BC] px-3 py-2 text-base lg:px-4 lg:py-3 lg:text-lg font-semibold text-[#07162b] transition-colors hover:bg-[#2ac8ce] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><span>১ ক্লিকে প্রশ্ন তৈরি</span><PlusSquare className="h-5 w-5" /></Link>}
          {sidebarGroups.map(group => {
            const links = <div className="space-y-1">{group.items.map(item => {
              const active = location.pathname === item.path;
              return <Link key={item.path} to={item.path} aria-current={active ? "page" : undefined} onClick={() => setSidebarOpen(false)} className={cn("sidebar-nav-item flex items-center gap-3 rounded-lg border-l-2 px-2 py-1.5 text-[16px] lg:px-3 lg:py-2 lg:text-[18px] font-semibold leading-6 lg:leading-7 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00B4BC]", active ? "border-[#00B4BC] bg-white/10 text-white" : "border-transparent text-white hover:bg-white/5")}><item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#00B4BC]" : "text-slate-200")} strokeWidth={1.8} /><span>{item.label}</span></Link>;
            })}</div>;
            return group.label === "OMR সরঞ্জাম" || group.label === "সহায়তা" ? <details key={group.label} open={group.items.some(item => location.pathname === item.path)} className="sidebar-nav-group group"><summary className="cursor-pointer rounded px-2 py-1.5 text-[16px] lg:px-3 lg:py-2 lg:text-[18px] font-semibold leading-6 lg:leading-7 text-white hover:text-white">{group.label}</summary><div className="mt-1">{links}</div></details> : <section key={group.label}>{group.label && <h2 className="mb-2 px-3 text-sm font-semibold text-slate-200">{group.label}</h2>}{links}</section>;
          })}
        </nav>

        {/* Affiliate Program Button */}
        <div className="p-2.5 pt-1.5 shrink-0 border-t border-white/10 bg-[#07162b]/80 space-y-1.5">
          <Link
            to="/dashboard/affiliate"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-center transition-all duration-150 shadow-sm border",
              location.pathname === "/dashboard/affiliate"
                ? "bg-white/10 text-white border-transparent font-bold"
                : "bg-[#0f2c54] hover:bg-[#153e77] text-white border-[#1e467d] hover:border-[#00B4BC]/60"
            )}
          >
            <Award className="w-4 h-4 text-[#00B4BC] shrink-0" />
            <span className="min-w-0 whitespace-nowrap overflow-visible leading-5">প্রশ্নল্যাব এফিলিয়েট প্রোগ্রাম</span>
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold text-white hover:bg-white/10 border border-white/20 transition-colors"
            >
              <Shield className="w-4 h-4" /> এডমিন প্যানেল
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="dashboard-header h-16 bg-white border-b border-border flex items-center justify-between px-4 shrink-0">
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
          <div id="question-picker-header-slot" className="flex-1 min-w-0 mx-3" />
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="প্রোফাইল মেনু" className="relative rounded-full p-1 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#00B4BC] hover:bg-slate-100 transition-colors">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200" /> : <span className="w-9 h-9 rounded-full bg-[#0A1E38] flex items-center justify-center"><User className="w-4 h-4 text-white" /></span>}
                  <span aria-hidden className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#0A1E38] text-white text-[10px]">?</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl border-slate-200 bg-white p-1.5 shadow-xl">
                <DropdownMenuLabel className="px-3 py-3 font-normal">
                  <p className="text-base font-semibold text-[#0A1E38]">{fullName}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[
                  { path: '/dashboard', label: 'শিক্ষক ড্যাশবোর্ড', icon: LayoutDashboard },
                  { path: '/dashboard/create', label: '১ ক্লিকে প্রশ্ন তৈরি', icon: PlusSquare },
                  { path: '/dashboard/my-questions', label: 'আমার তৈরি প্রশ্ন', icon: FileText },
                  { path: '/dashboard/smartboard', label: 'স্মার্টবোর্ড', icon: Tv },
                  { path: '/dashboard/omr-evaluation', label: 'OMR মূল্যায়ন', icon: CheckCircle2 },
                  { path: '/dashboard/subscription', label: 'আমার সাবস্ক্রিপশন', icon: CreditCard },
                  { path: '/dashboard/institute', label: 'প্রতিষ্ঠান সেটিংস', icon: Building2 },
                ].filter(item => !hiddenPages.includes(item.path)).map(item => <DropdownMenuItem key={item.path} asChild className="cursor-pointer rounded-lg px-3 py-2 text-base text-[#0A1E38] focus:bg-[#00B4BC]/10"><Link to={item.path} className="flex items-center gap-3"><item.icon className="h-4 w-4 text-[#00858C]" /><span>{item.label}</span></Link></DropdownMenuItem>)}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut} className="cursor-pointer justify-center gap-2 rounded-lg px-3 py-2 text-base text-rose-700 focus:bg-rose-50 focus:text-rose-700"><LogOut className="h-4 w-4" />লগআউট</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <AnnouncementBar />

        <main className="flex-1 bg-white overflow-y-auto p-3 sm:p-4 md:p-6 lg:overflow-visible">
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
