import { useEffect, useState, useMemo } from "react";
import { Megaphone, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<{ id: number; text: string }[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("id, text")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data?.length) setAnnouncements(data);
      });
  }, []);

  // Build the marquee text by joining all announcements
  const marqueeText = useMemo(() => {
    if (!announcements.length) return "";
    return announcements.map(a => a.text).join("   ✦   ");
  }, [announcements]);

  if (!announcements.length || dismissed) return null;

  return (
    <div className="w-full relative overflow-hidden group bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 shadow-lg shadow-primary/20">
      {/* Animated shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite] pointer-events-none" />
      
      {/* Glowing bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-300/0 via-emerald-200/80 to-emerald-300/0" />

      <div className="flex items-center py-2.5 px-3 min-h-[44px]">
        {/* Icon with pulse */}
        <div className="shrink-0 mr-2 relative">
          <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
          <div className="relative bg-white/15 backdrop-blur-sm rounded-full p-1.5 border border-white/20">
            <Megaphone className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Sparkle separator */}
        <Sparkles className="w-3 h-3 text-emerald-200/70 shrink-0 mr-2 animate-pulse" />

        {/* Infinite marquee */}
        <div className="flex-1 overflow-hidden relative mask-marquee">
          <div className="flex whitespace-nowrap animate-[marquee_25s_linear_infinite] group-hover:[animation-play-state:paused]">
            <span className="text-sm font-semibold text-white tracking-wide drop-shadow-sm px-2">
              {marqueeText}
            </span>
            <span className="text-sm font-semibold text-white tracking-wide drop-shadow-sm px-2" aria-hidden="true">
              {marqueeText}
            </span>
            <span className="text-sm font-semibold text-white tracking-wide drop-shadow-sm px-2" aria-hidden="true">
              {marqueeText}
            </span>
          </div>
        </div>

        {/* Sparkle separator */}
        <Sparkles className="w-3 h-3 text-emerald-200/70 shrink-0 ml-2 animate-pulse [animation-delay:1s]" />

        {/* Close button */}
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 ml-2 p-1.5 rounded-full bg-white/0 hover:bg-white/20 active:bg-white/30 transition-all duration-300 hover:rotate-90 hover:scale-110 border border-transparent hover:border-white/30"
          aria-label="বন্ধ করুন"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.33%); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .mask-marquee {
          mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
        }
      `}</style>
    </div>
  );
}
