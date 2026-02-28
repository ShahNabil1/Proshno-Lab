import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronRight, LogOut, User, PenLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.png";
import bkashLogo from "@/assets/bkash-logo.webp";
import nagadLogo from "@/assets/nagad-logo.png";
import rocketLogo from "@/assets/rocket-logo.png";
import upayLogo from "@/assets/upay-logo.webp";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";



export default function Layout({ children }: {children: React.ReactNode;}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHeroPage = location.pathname === "/";

  const handleCreateQuestion = () => {
    if (user) {
      navigate("/dashboard/create");
    } else {
      navigate("/login");
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const headerBg = scrolled ?
  "bg-card/90 backdrop-blur-xl shadow-[0_1px_3px_hsl(207_60%_15%/0.08)] border-b border-border" :
  isHeroPage ?
  "bg-transparent" :
  "bg-card border-b border-border";

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

          <nav className="hidden md:flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleCreateQuestion}
              className="gradient-green text-primary-foreground border-0 font-heading font-semibold px-5 rounded-lg gap-2"
            >
              <PenLine className="w-4 h-4" />
              প্রশ্ন তৈরী করুন
            </Button>
            {user ?
              <div className="flex items-center gap-2">
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className={cn("font-heading font-medium", mutedTextColor)}>
                    ড্যাশবোর্ড
                  </Button>
                </Link>
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
            :
              <Link to="/login">
                <Button size="sm" variant="outline" className={cn("font-heading font-semibold px-5 rounded-lg", mutedTextColor, "border-white/30 hover:bg-white/10")}>
                  লগইন করুন
                </Button>
              </Link>
            }
          </nav>

          <Button
            variant="ghost"
            size="icon"
            className={cn("md:hidden", textColor)}
            onClick={() => setMobileOpen(!mobileOpen)}>

            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        <AnimatePresence>
          {mobileOpen &&
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden bg-card border-t border-border">

              <div className="container py-4 flex flex-col gap-2">
                <Button
                  onClick={handleCreateQuestion}
                  className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold rounded-lg gap-2"
                >
                  <PenLine className="w-4 h-4" />
                  প্রশ্ন তৈরী করুন
                </Button>
                {user &&
                  <div className="flex flex-col gap-2 mt-1">
                    <Link to="/dashboard">
                      <Button variant="outline" className="w-full font-heading font-medium rounded-lg">
                        ড্যাশবোর্ড
                      </Button>
                    </Link>
                    <div className="flex gap-2">
                      <Link to="/profile" className="flex-1">
                        <Button variant="outline" className="w-full gap-2 rounded-lg">
                          <User className="w-4 h-4" /> প্রোফাইল
                        </Button>
                      </Link>
                      <Button variant="outline" onClick={signOut} className="gap-2 rounded-lg">
                        <LogOut className="w-4 h-4" /> লগআউট
                      </Button>
                    </div>
                  </div>
                }
              </div>
            </motion.nav>
          }
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
              <p className="leading-relaxed text-green-50 text-base text-left">
                📢 প্রশ্ন তৈরি করার স্মার্ট সমাধান!📢
                <br />
                💡স্মার্ট শিক্ষকদের জন্য স্মার্ট সমাধান💡
              </p>
            </div>

            <div>
              <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-white/40 mb-4">কোম্পানি</h4>
              <ul className="space-y-2.5">
                <li><Link to="/terms" className="text-white/60 hover:text-white text-sm transition-colors">টার্মস এন্ড কন্ডিশন</Link></li>
                <li><Link to="/privacy" className="text-white/60 hover:text-white text-sm transition-colors">প্রাইভেসি পলিসি</Link></li>
                <li><Link to="/refund" className="text-white/60 hover:text-white text-sm transition-colors">রিফান্ড পলিসি</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-white/40 mb-4">অন্যান্য</h4>
              <ul className="space-y-2.5">
                {["অফার সমূহ", "ব্লগ", "সাহায্য কেন্দ্র"].map((t) => <li key={t}><a href="#" className="text-white/60 hover:text-white text-sm transition-colors">{t}</a></li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-white/40 mb-4">যোগাযোগ</h4>
              <ul className="space-y-2.5 text-white/60 text-sm">
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span>Ulipur, Pallimongol Hat, Bogura Sadar, Bogura, Bangladesh - 5800</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  <a href="tel:+8801340345787" className="hover:text-white transition-colors">০১৩৪০-৩৪৫৭৮৭</a>
                </li>
                <li className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  <a href="mailto:hello@eexamapp.com" className="hover:text-white transition-colors">hello@eexamapp.com</a>
                </li>
              </ul>
              {/* Social icons */}
              <div className="flex items-center gap-3 mt-4">
                <a href="https://www.facebook.com/eexamapp" target="_blank" rel="noopener noreferrer" className="group p-2 rounded-lg bg-white/10 transition-all hover:bg-[#1877F2]" aria-label="Facebook">
                  <svg className="h-5 w-5 text-white/60 transition-colors group-hover:text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a href="https://www.youtube.com/@eExamapp" target="_blank" rel="noopener noreferrer" className="group p-2 rounded-lg bg-white/10 transition-all hover:bg-[#FF0000]" aria-label="YouTube">
                  <svg className="h-5 w-5 text-white/60 transition-colors group-hover:text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">© ২০২৬ eExamapp — সর্বস্বত্ব সংরক্ষিত</p>
            <div className="flex items-center gap-4">
              <img src={bkashLogo} alt="bKash" className="h-10 w-auto object-contain rounded-md bg-white px-2.5 py-1.5" loading="eager" />
              <img src={nagadLogo} alt="Nagad" className="h-10 w-auto object-contain rounded-md bg-white px-2.5 py-1.5" loading="eager" />
              <img src={rocketLogo} alt="Rocket" className="h-10 w-auto object-contain rounded-md bg-white px-2.5 py-1.5" loading="eager" />
              <img src={upayLogo} alt="Upay" className="h-10 w-auto object-contain rounded-md bg-white px-2.5 py-1.5" loading="eager" />
            </div>
          </div>
        </div>
      </footer>
    </div>);

}