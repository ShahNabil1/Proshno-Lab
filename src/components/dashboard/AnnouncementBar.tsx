import { useEffect, useState, useRef, useMemo } from "react";
import { Megaphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<{ id: number; text: string }[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  // Version-based dismiss: reappear if announcements change
  const announcementVersion = useMemo(
    () => announcements.map(a => a.id).sort().join(","),
    [announcements]
  );

  useEffect(() => {
    supabase
      .from("announcements")
      .select("id, text")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          setAnnouncements(data);
          setTimeout(() => setVisible(true), 100);
        }
      });
  }, []);

  // Reset dismiss if announcements change
  useEffect(() => {
    if (!announcementVersion) return;
    const stored = sessionStorage.getItem("ann_dismissed_ver");
    if (stored === announcementVersion) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }
  }, [announcementVersion]);

  // Cycle through announcements
  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((p) => (p + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [announcements.length]);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("ann_dismissed_ver", announcementVersion);
  };

  if (!announcements.length || dismissed) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={visible ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full relative overflow-hidden"
    >
      {/* Animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, hsl(155 72% 22%) 0%, hsl(155 72% 36%) 40%, hsl(160 60% 30%) 70%, hsl(155 72% 22%) 100%)",
          backgroundSize: "300% 300%",
          animation: "announcement-gradient 8s ease infinite",
        }}
      />

      {/* Glassmorphism overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Glowing bottom border */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(155 72% 55% / 0.7) 30%, hsl(155 72% 65% / 0.9) 50%, hsl(155 72% 55% / 0.7) 70%, transparent 100%)",
          boxShadow: "0 0 8px hsl(155 72% 50% / 0.4), 0 0 20px hsl(155 72% 50% / 0.2)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center gap-3 px-4 md:px-6 py-2.5 min-h-[44px]">
        {/* Pulsing megaphone icon */}
        <div className="shrink-0 relative flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "hsl(155 72% 55% / 0.3)",
              animation: "announcement-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <Megaphone className="w-4 h-4 text-white relative z-10" />
        </div>

        {/* Announcement text area */}
        <div className="flex-1 overflow-hidden relative" style={{ minHeight: "22px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={announcements[current]?.id}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="text-center"
            >
              <p
                className="text-sm md:text-[13px] text-white font-bold leading-snug"
                style={{ fontFamily: "'SolaimanLipi', sans-serif" }}
                dangerouslySetInnerHTML={{ __html: announcements[current]?.text || "" }}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Counter badge */}
        {announcements.length > 1 && (
          <span
            className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              background: "hsl(0 0% 100% / 0.15)",
              color: "hsl(0 0% 100% / 0.7)",
            }}
          >
            {current + 1}/{announcements.length}
          </span>
        )}

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-full transition-all duration-200"
          style={{
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "hsl(0 0% 100% / 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          aria-label="বন্ধ করুন"
        >
          <X className="w-3.5 h-3.5 text-white/70" />
        </button>
      </div>
    </motion.div>
  );
}
