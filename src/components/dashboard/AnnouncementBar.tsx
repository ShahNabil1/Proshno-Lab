import { useEffect, useState, useRef } from "react";
import { Megaphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<{ id: number; text: string }[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

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

  // Cycle through announcements
  useEffect(() => {
    if (announcements.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [announcements.length]);

  if (!announcements.length || dismissed) return null;

  return (
    <div className="w-full bg-primary text-primary-foreground relative overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 min-h-[40px]">
        <Megaphone className="w-4 h-4 shrink-0 opacity-80" />

        <div className="flex-1 overflow-hidden relative h-5">
          {announcements.map((a, i) => (
            <p
              key={a.id}
              className={cn(
                "absolute inset-0 text-sm font-body truncate transition-all duration-500 ease-in-out",
                i === current
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4 pointer-events-none"
              )}
            >
              {a.text}
            </p>
          ))}
        </div>

        {announcements.length > 1 && (
          <span className="text-[10px] opacity-60 shrink-0">
            {current + 1}/{announcements.length}
          </span>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-0.5 rounded hover:bg-primary-foreground/20 transition-colors"
          aria-label="বন্ধ করুন"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
