import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogOut, User, Heart, MapPin, Phone, Mail, Facebook, Instagram, Linkedin, Youtube, Twitter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { analytics } from "@/lib/analytics";



export default function Layout({ children }: {children: React.ReactNode;}) {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHeroPage = location.pathname === "/";
  const navigate = useNavigate();
  void navigate;


  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    analytics.pageView(location.pathname, document.title);
  }, [location.pathname]);

  const headerBg = scrolled
    ? "bg-white/95 backdrop-blur-xl shadow-[0_1px_0_hsl(224_25%_90%)]"
    : isHeroPage
    ? "bg-white/90 backdrop-blur-sm border-b border-white/40"
    : "bg-white border-b border-border";

  const navLinks = [
    { to: "/", label: "হোম" },
    { to: "/dashboard/create?mode=auto", label: "অটো প্রশ্ন তৈরি" },
    { to: user ? "/dashboard" : "/login", label: "ড্যাশবোর্ড" },
    { to: "/pricing", label: "প্যাকেজ" },
    { to: "/demo", label: "টিউটোরিয়াল" },
    { to: "/dashboard/contact", label: "হেল্পলাইন" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background font-body">
      <header className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", headerBg)}>
        <div className="container flex items-center justify-between h-16 lg:h-[76px]">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="leading-none">
              <div
                className="font-bold text-[30px] lg:text-[34px] text-navy tracking-tight"
                style={{ fontFamily: "'Hind Siliguri', 'SolaimanLipi', serif", letterSpacing: "-0.5px" }}
              >
                প্রশ্ন<span className="bg-gradient-to-r from-gold via-amber-400 to-gold bg-clip-text text-transparent italic">ল্যাব</span>
              </div>
              <div className="text-[11px] lg:text-[12px] text-navy/70 mt-1 font-medium">
                শিক্ষকদের জন্য <span className="text-gold font-bold">ফ্রী</span> প্রশ্ন তৈরির প্ল্যাটফর্ম...
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((l) => {
              const active = location.pathname === l.to.split("?")[0];
              return (
                <Link
                  key={l.label}
                  to={l.to}
                  className={cn(
                    "relative px-3.5 py-2 text-[15px] font-medium text-navy/80 hover:text-navy transition-colors",
                    active && "text-navy"
                  )}
                >
                  <span className={cn("relative", active && "link-underline-gold pb-1")}>
                    {l.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to="/profile" className="hidden md:inline-flex">
                  <Button variant="ghost" size="sm" className="gap-2 text-navy/80 hover:text-navy hover:bg-navy/5">
                    <User className="w-4 h-4" />
                    {user.user_metadata?.full_name?.split(" ")[0] || "প্রোফাইল"}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-navy/70 hover:text-navy hover:bg-navy/5"
                  onClick={signOut}
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button
                  size="sm"
                  className="btn-gold border-0 font-heading font-bold px-5 h-10 rounded-lg gap-2 shadow-sm"
                >
                  <User className="w-4 h-4" />
                  লগইন
                </Button>
              </Link>
            )}
            {/* Mobile menu */}
            <button
              className="lg:hidden p-2 rounded-lg text-navy hover:bg-navy/5"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:hidden overflow-hidden bg-white border-t border-border"
            >
              <div className="container py-3 flex flex-col">
                {navLinks.map((l) => (
                  <Link
                    key={l.label}
                    to={l.to}
                    className="px-2 py-2.5 text-[15px] font-medium text-navy/80 hover:text-navy hover:bg-navy/5 rounded-lg"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 text-slate-500">
        <div className="container py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
            <p className="text-slate-500">© 2026 Proshno Lab. All rights reserved.</p>

            <p className="inline-flex items-center gap-1.5 text-slate-500">
              Designed & Developed by
              <a
                href="https://www.shahnabil.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-700 hover:text-navy transition-colors"
              >
                Shahriar Nabil
              </a>
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
            </p>

            <div className="flex items-center gap-4">
              <Link to="/terms" className="text-slate-500 hover:text-navy transition-colors">Terms & Conditions</Link>
              <span className="text-slate-300">•</span>
              <Link to="/privacy" className="text-slate-500 hover:text-navy transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>);

}