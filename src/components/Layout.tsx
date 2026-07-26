import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogOut, User, MapPin, Phone, Mail, LayoutDashboard } from "lucide-react";
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
    { to: "/demo", label: "টিউটোরিয়াল" },
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
              <div className="flex items-baseline gap-1 text-[11px] lg:text-[12px] text-white mt-1 font-bold tracking-wide">
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
      {!isDemoPage && <footer className="bg-[#022548] text-white/90">
        <div className="container py-6 lg:py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 items-start">
            {/* Brand */}
            <div className="space-y-4">
              <Link to="/" className="inline-block">
                <BrandLogo size={36} className="lg:text-[42px] [&_.text-brand-navy]:text-white" />
              </Link>
              <p className="text-sm leading-relaxed text-white/80">
                শিক্ষকদের জন্য <span className="text-[#F4C053] font-bold">ফ্রী</span> প্রশ্ন তৈরির প্ল্যাটফর্ম। স্মার্ট শিক্ষকদের জন্য স্মার্ট সমাধান ✨
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-heading font-bold text-white text-base mb-4">কুইক লিংক</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/" className="text-white/80 hover:text-white transition-colors">হোম</Link></li>
                <li><Link to="/dashboard/create?mode=auto" className="text-white/80 hover:text-white transition-colors">অটো প্রশ্ন তৈরি</Link></li>
                <li><Link to="/pricing" className="text-white/80 hover:text-white transition-colors">প্যাকেজ ও মূল্য</Link></li>
                <li><Link to="/demo" className="text-white/80 hover:text-white transition-colors">টিউটোরিয়াল</Link></li>
                <li><Link to="/helpline" className="text-white/80 hover:text-white transition-colors">হেল্পলাইন</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-heading font-bold text-white text-base mb-4">যোগাযোগ</h4>
              <ul className="space-y-3.5 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin className="w-[18px] h-[18px] text-[#F4C053] mt-0.5 shrink-0" />
                  <span className="text-white/80">ময়মনসিংহ, বাংলাদেশ</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-[18px] h-[18px] text-[#F4C053] shrink-0" />
                  <a href="tel:+8809696638867" className="text-white/80 hover:text-white transition-colors">+880 9696-638867</a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-[18px] h-[18px] text-[#F4C053] shrink-0" />
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
            <div>© 2026 Proshno Lab. All rights reserved.</div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/80">
              <span>Developed by</span>
              <a
                href="https://www.shahnabil.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white hover:text-[#F4C053] transition-colors"
              >
                Shahriar Nabil
              </a>
            </div>
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