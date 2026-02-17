import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronRight, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.png";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { path: "/", label: "হোম" },
  { path: "/questions/mcq", label: "প্রশ্নব্যাংক" },
  { path: "/pricing", label: "মূল্য তালিকা" },
  { path: "/demo", label: "ডেমো" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHeroPage = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const headerBg = scrolled
    ? "bg-card/90 backdrop-blur-xl shadow-[0_1px_3px_hsl(207_60%_15%/0.08)] border-b border-border"
    : isHeroPage
      ? "bg-transparent"
      : "bg-card border-b border-border";

  const textColor = !scrolled && isHeroPage ? "text-white" : "text-foreground";
  const mutedTextColor = !scrolled && isHeroPage ? "text-white/70" : "text-muted-foreground";

  return (
    <div className="min-h-screen flex flex-col bg-background font-body">
      <header className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", headerBg)}>
        <div className="container flex items-center justify-between h-16 lg:h-[72px]">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoImg} alt="eExamapp" className="w-9 h-9 rounded-lg object-contain" />
            <span className={cn("font-heading font-bold text-xl tracking-tight", textColor)}>
              eExam<span className="text-gradient-green">app</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <button
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === item.path
                      ? "bg-primary/10 text-primary"
                      : cn("hover:bg-primary/5", mutedTextColor)
                  )}
                >
                  {item.label}
                </button>
              </Link>
            ))}
            {user ? (
              <div className="flex items-center gap-2 ml-3">
                <Link to="/profile">
                  <Button variant="ghost" size="sm" className={cn("gap-2", mutedTextColor)}>
                    <User className="w-4 h-4" />
                    {user.user_metadata?.full_name?.split(" ")[0] || "প্রোফাইল"}
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className={cn(mutedTextColor)} onClick={signOut}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Link to="/login" className="ml-3">
                <Button size="sm" className="gradient-green text-primary-foreground border-0 font-heading font-semibold px-5 rounded-lg">
                  লগইন করুন
                </Button>
              </Link>
            )}
          </nav>

          <Button
            variant="ghost"
            size="icon"
            className={cn("md:hidden", textColor)}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden bg-card border-t border-border"
            >
              <div className="container py-4 flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link key={item.path} to={item.path}>
                    <button
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between transition-colors",
                        location.pathname === item.path
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {item.label}
                      <ChevronRight className="w-4 h-4 opacity-40" />
                    </button>
                  </Link>
                ))}
                {user ? (
                  <div className="flex gap-2 mt-2">
                    <Link to="/profile" className="flex-1">
                      <Button variant="outline" className="w-full gap-2 rounded-lg">
                        <User className="w-4 h-4" /> প্রোফাইল
                      </Button>
                    </Link>
                    <Button variant="outline" onClick={signOut} className="gap-2 rounded-lg">
                      <LogOut className="w-4 h-4" /> লগআউট
                    </Button>
                  </div>
                ) : (
                  <Link to="/login" className="mt-2">
                    <Button className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold rounded-lg">
                      লগইন করুন
                    </Button>
                  </Link>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="gradient-hero text-white">
        <div className="container py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <img src={logoImg} alt="eExamapp" className="w-9 h-9 rounded-lg object-contain" />
                <span className="font-heading font-bold text-xl">eExamapp</span>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                ১ ক্লিকে প্রশ্ন তৈরির সফটওয়্যার + অধ্যায়ভিত্তিক প্রশ্ন সরবরাহ ও অনলাইন পরীক্ষা
              </p>
            </div>

            <div>
              <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-white/40 mb-4">কোম্পানি</h4>
              <ul className="space-y-2.5">
                {["টার্মস এন্ড কন্ডিশন", "প্রাইভেসি পলিসি", "রিফান্ড পলিসি"].map(t => (
                  <li key={t}><a href="#" className="text-white/60 hover:text-white text-sm transition-colors">{t}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-white/40 mb-4">অন্যান্য</h4>
              <ul className="space-y-2.5">
                {["অফার সমূহ", "ব্লগ", "সাহায্য কেন্দ্র"].map(t => (
                  <li key={t}><a href="#" className="text-white/60 hover:text-white text-sm transition-colors">{t}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-white/40 mb-4">যোগাযোগ</h4>
              <ul className="space-y-2.5 text-white/60 text-sm">
                <li>মোবাইল: ০১৭১১-০০০০০০</li>
                <li>ইমেইল: hello@eexamapp.com</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">© ২০২৬ eExamapp — সর্বস্বত্ব সংরক্ষিত</p>
            <div className="flex items-center gap-3">
              {["bKash", "Nagad", "Visa", "Mastercard"].map(p => (
                <span key={p} className="px-3 py-1.5 rounded-md bg-white/10 text-white/50 text-xs font-medium">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
