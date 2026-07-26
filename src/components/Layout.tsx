import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogOut, User, MapPin, Phone, Mail, Sparkles, LayoutDashboard } from "lucide-react";
import { FaFacebook, FaInstagram, FaYoutube, FaWhatsapp, FaTiktok } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { analytics } from "@/lib/analytics";
import BrandLogo from "@/components/BrandLogo";



export default function Layout({ children }: {children: React.ReactNode;}) {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHeroPage = location.pathname === "/";
  const isDemoPage = location.pathname === "/demo";
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
    ? "bg-[#1E3577]/95 backdrop-blur-xl shadow-lg"
    : "bg-[#1E3577] border-b border-white/10";

  const navLinks = [
    { to: "/", label: "হোম" },
    { to: "/dashboard/create?mode=auto", label: "অটো প্রশ্ন তৈরি" },
    { to: user ? "/dashboard" : "/login", label: "ড্যাশবোর্ড" },
    { to: "/pricing", label: "প্যাকেজ" },
    { to: "/demo", label: "ডেমো" },
    { to: "/helpline", label: "হেল্পলাইন" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background font-body">
      <header className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", headerBg)}>
        <div className="container flex items-center justify-between h-16 lg:h-[76px]">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="leading-none">
              <BrandLogo size={38} className="lg:text-[44px] [&_.text-brand-navy]:text-white" />
              <div className="flex items-baseline gap-1 text-[11px] lg:text-[12px] text-white/75 mt-1 font-medium">
                <span>শিক্ষকদের জন্য</span>
                <span className="brand-free">ফ্রী</span>
                <span>প্রশ্ন তৈরির প্ল্যাটফর্ম...</span>
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
                    "relative px-3.5 py-2 text-[15px] font-medium text-white/80 hover:text-white transition-colors",
                    active && "text-white"
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
                <Link to="/dashboard">
                  <Button size="sm" className="btn-gold border-0 font-heading font-bold px-4 h-10 rounded-lg gap-2 shadow-sm">
                    <LayoutDashboard className="w-4 h-4" />
                    ড্যাশবোর্ড
                  </Button>
                </Link>
                <Link to="/profile" className="hidden md:inline-flex">
                  <Button variant="ghost" size="sm" className="gap-2 text-white/80 hover:text-white hover:bg-white/10">
                    <User className="w-4 h-4" />
                    {user.user_metadata?.full_name?.split(" ")[0] || "প্রোফাইল"}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/70 hover:text-white hover:bg-white/10"
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
              className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10"
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
              className="lg:hidden overflow-hidden bg-[#1E3577] border-t border-white/10"
            >
              <div className="container py-3 flex flex-col">
                {navLinks.map((l) => (
                  <Link
                    key={l.label}
                    to={l.to}
                    className="px-2 py-2.5 text-[15px] font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
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

      {/* Footer — hidden on demo page */}
      {!isDemoPage && <footer className="bg-white border-t border-slate-200 text-slate-600">
        <div className="container py-10 lg:py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            {/* Brand */}
            <div className="space-y-4">
              <Link to="/" className="inline-block">
                <BrandLogo size={36} className="lg:text-[42px]" />
              </Link>
              <p className="text-sm leading-relaxed text-slate-500">
                শিক্ষকদের জন্য <span className="text-gold font-bold">ফ্রী</span> প্রশ্ন তৈরির প্ল্যাটফর্ম। স্মার্ট শিক্ষকদের জন্য স্মার্ট সমাধান ✨
              </p>
              {/* Social */}
              <div className="flex items-center gap-3 pt-1">
                <a href="https://facebook.com/proshnolab" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-[#1877F2]/10 transition-colors hover:scale-110">
                  <FaFacebook className="w-[18px] h-[18px] text-[#1877F2]" />
                </a>
                <a href="https://instagram.com/proshnolab" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-[#E4405F]/10 transition-colors hover:scale-110">
                  <FaInstagram className="w-[18px] h-[18px] text-[#E4405F]" />
                </a>
                <a href="https://youtube.com/@proshnolab" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-[#FF0000]/10 transition-colors hover:scale-110">
                  <FaYoutube className="w-[18px] h-[18px] text-[#FF0000]" />
                </a>
                <a href="https://wa.me/8801758018668" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-[#25D366]/10 transition-colors hover:scale-110">
                  <FaWhatsapp className="w-[18px] h-[18px] text-[#25D366]" />
                </a>
                <a href="https://tiktok.com/@proshnolab" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-black/5 transition-colors hover:scale-110">
                  <FaTiktok className="w-[18px] h-[18px] text-black" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-heading font-bold text-navy text-base mb-4">কুইক লিংকস</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/" className="text-slate-500 hover:text-navy transition-colors">হোম</Link></li>
                <li><Link to="/dashboard/create?mode=auto" className="text-slate-500 hover:text-navy transition-colors">অটো প্রশ্ন তৈরি</Link></li>
                <li><Link to="/pricing" className="text-slate-500 hover:text-navy transition-colors">প্যাকেজ ও মূল্য</Link></li>
                <li><Link to="/demo" className="text-slate-500 hover:text-navy transition-colors">ডেমো</Link></li>
                <li><Link to="/helpline" className="text-slate-500 hover:text-navy transition-colors">হেল্পলাইন</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-heading font-bold text-navy text-base mb-4">যোগাযোগ</h4>
              <ul className="space-y-3.5 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin className="w-[18px] h-[18px] text-gold mt-0.5 shrink-0" />
                  <span className="text-slate-500">ময়মনসিংহ, বাংলাদেশ</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-[18px] h-[18px] text-gold shrink-0" />
                  <a href="tel:+8809696638867" className="text-slate-500 hover:text-navy transition-colors">+880 9696-638867</a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-[18px] h-[18px] text-gold shrink-0" />
                  <a href="mailto:proshnolab@gmail.com" className="text-slate-500 hover:text-navy transition-colors">proshnolab@gmail.com</a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div>© 2026 Proshno Lab. All rights reserved.</div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-500">
              <span>Developed by</span>
              <a
                href="https://www.shahnabil.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-700 hover:text-navy transition-colors"
              >
                Shahriar Nabil
              </a>
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="flex items-center gap-2">
              <Link to="/terms" className="hover:text-navy transition-colors">Terms & Conditions</Link>
              <span className="text-slate-400">•</span>
              <Link to="/privacy" className="hover:text-navy transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>}
    </div>);

}