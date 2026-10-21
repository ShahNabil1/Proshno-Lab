import BrandLogo from "@/components/BrandLogo";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogOut, User, MapPin, Phone, Mail, LayoutDashboard } from "lucide-react";
import { FaFacebook, FaInstagram, FaYoutube, FaWhatsapp, FaTiktok } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import BrandLockup from "@/components/BrandLockup";




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
  }, [location.pathname]);

  const headerBg = isHeroPage ? "bg-[#0A1E38]/95 backdrop-blur-xl border-b border-white/10" : scrolled
    ? "bg-[#0A1E38]/95 backdrop-blur-xl shadow-lg"
    : "bg-[#0A1E38] border-b border-white/10";

  const navLinks = [
    { to: "/", label: "হোম" },
    { to: "/dashboard/create?mode=auto", label: "অটো প্রশ্ন তৈরি" },
    ...(!user ? [{ to: "/login", label: "ড্যাশবোর্ড" }] : []),
    { to: "/pricing", label: "প্যাকেজ" },
    { to: "/helpline", label: "হেল্পলাইন" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background font-body">
      <header className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", headerBg)}>
        <div className="container flex items-center justify-between gap-2 h-16 lg:h-[76px]">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 lg:gap-3 group shrink-0 lg:flex-1">
            <span className="lg:hidden"><BrandLockup size={24} /></span>
            <span className="hidden lg:inline-flex"><BrandLockup size={40} /></span>
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
                  <span className={cn("relative", active && "border-b border-white/70 pb-1")}>
                    {l.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link to="/pricing" onClick={() => setMobileOpen(false)} className="lg:hidden inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-lg border border-teal-300/40 bg-[#00B4BC] px-2.5 text-[13px] font-bold text-[#07162b] hover:bg-[#2ac8ce] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="প্যাকেজ ও মূল্য">প্যাকেজ</Link>
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button size="sm" className="bg-white text-[#0A1E38] hover:bg-slate-100 border-0 font-heading font-bold px-2.5 sm:px-4 h-9 sm:h-10 rounded-lg gap-1.5 sm:gap-2 shadow-sm text-[13px] sm:text-sm">
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">ড্যাশবোর্ড</span>
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
                  className="hidden sm:inline-flex h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={signOut}
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Link to="/login" aria-label="লগইন">
                <Button
                  size="sm"
                  className="bg-white text-[#0A1E38] hover:bg-slate-100 border-0 font-heading font-bold px-3 sm:px-5 h-9 sm:h-10 rounded-lg gap-1.5 sm:gap-2 shadow-sm text-[13px] sm:text-sm"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className="hidden min-[400px]:inline">লগইন</span>
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
              className="lg:hidden overflow-hidden bg-[#0A1E38] border-t border-white/10"
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
      {!isDemoPage && <footer className="bg-[#0A1E38] text-white/90">
        <div className="container py-6 lg:py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 items-start">
            {/* Brand */}
            <div className="space-y-4">
              <Link to="/" className="inline-flex items-center gap-2 lg:gap-3">
                <BrandLockup size={36} />
              </Link>

            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-heading font-bold text-white text-base mb-4">কুইক লিংক</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/" className="text-white/80 hover:text-white transition-colors">হোম</Link></li>
                <li><Link to="/dashboard/create?mode=auto" className="text-white/80 hover:text-white transition-colors">অটো প্রশ্ন তৈরি</Link></li>
                <li><Link to="/pricing" className="text-white/80 hover:text-white transition-colors" aria-label="প্যাকেজ ও মূল্য">প্যাকেজ</Link></li>
                <li><Link to="/helpline" className="text-white/80 hover:text-white transition-colors">হেল্পলাইন</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-heading font-bold text-white text-base mb-4">যোগাযোগ</h4>
              <ul className="space-y-3.5 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin className="w-[18px] h-[18px] text-[#00B4BC] mt-0.5 shrink-0" />
                  <span className="text-white/80">ময়মনসিংহ, বাংলাদেশ</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-[18px] h-[18px] text-[#00B4BC] shrink-0" />
                  <a href="tel:+8809696638867" className="text-white/80 hover:text-white transition-colors">+880 9696-638867</a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-[18px] h-[18px] text-[#00B4BC] shrink-0" />
                  <a href="mailto:hi@proshnolab.com" className="text-white/80 hover:text-white transition-colors">hi@proshnolab.com</a>
                </li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-heading font-bold text-white text-base mb-4">আমাদের সাথে যুক্ত থাকুন:</h4>
              <div className="flex flex-wrap items-center gap-4">
                <a href="https://facebook.com/proshnolab" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:scale-110 transition-transform">
                  <FaFacebook className="w-7 h-7 text-[#1877F2]" />
                </a>
                <a href="https://youtube.com/@proshnolab" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="hover:scale-110 transition-transform">
                  <FaYoutube className="w-7 h-7 text-[#FF0000]" />
                </a>
                <a href="https://tiktok.com/@proshnolab" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="hover:scale-110 transition-transform">
                  <FaTiktok className="w-7 h-7 text-white" />
                </a>
                <a href="https://instagram.com/proshnolab" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:scale-110 transition-transform">
                  <FaInstagram className="w-7 h-7 text-[#E4405F]" />
                </a>
                <a href="https://wa.me/8801758018668" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="hover:scale-110 transition-transform">
                  <FaWhatsapp className="w-7 h-7 text-[#25D366]" />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-white/70">
            <div>© 2026 <BrandLogo size={22} plate />. All rights reserved.</div>
            <div className="flex items-center gap-2">
              <Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
              <span className="text-white/40">•</span>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </footer>}
    </div>);

}
