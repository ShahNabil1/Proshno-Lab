import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { analytics, trackEvent } from "@/lib/analytics";

export default function MarketingTracker() {
  const { pathname, search } = useLocation();
  const lastPage = useRef("");
  useEffect(() => {
    // Only retain known navigation filters; never include payment/auth tokens.
    const query = new URLSearchParams(search);
    const filters = ["class", "version", "mode"].map(key => query.get(key) || "").join(":");
    const key = `${pathname}:${filters}`;
    if (lastPage.current === key) return;
    lastPage.current = key;
    if (pathname.startsWith("/admin") || pathname === "/auth/callback" || pathname === "/reset-password") return;
    analytics.pageView(pathname, document.title);
    if (["/pricing", "/dashboard/packages"].includes(pathname)) {
      analytics.viewItem("package-catalog", "Proshnolab packages", "subscription");
    }
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      const channel = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href) ? "whatsapp"
        : href.startsWith("tel:") ? "phone" : href.startsWith("mailto:") ? "email" : null;
      if (channel) trackEvent("contact", { channel });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
