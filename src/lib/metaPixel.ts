import { createMetaEvent, isStandardMetaEvent } from "./metaEvents";
type Params = Record<string, unknown>;
type PixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: PixelFunction;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window { fbq?: PixelFunction; _fbq?: PixelFunction; }
}

// Keep IDs as strings: this dataset ID exceeds JavaScript's safe integer range.
const pixelId = import.meta.env.VITE_META_PIXEL_ID || "39691774247102448";
const sent = new Set<string>();
let initialized = false;

export function initMetaPixel(): boolean {
  if (!/^\d+$/.test(pixelId) || import.meta.env.VITE_META_PIXEL_ENABLED === "false") return false;
  if (initialized) return true;
  if (!window.fbq) {
    const fbq: PixelFunction = Object.assign((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }, { queue: [] as unknown[][], loaded: true, version: "2.0" });
    fbq.push = fbq;
    window.fbq = fbq;
    window._fbq = window._fbq || fbq;
  }
  window.fbq("set", "autoConfig", false, pixelId);
  window.fbq("init", pixelId);
  initialized = true;
  if (!document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]')) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  return true;
}

export function trackMetaEvent(name: string, params: Params = {}, suppliedEventId?: string): void {
  // Do not market internal admin activity or authentication callback pages.
  if (/^\/(admin(?:\/|$)|auth\/callback|reset-password)/.test(window.location.pathname)) return;
  const event = createMetaEvent(name, params, suppliedEventId);
  if (!event) return;
  const persistent = name === "purchase" || (name === "sign_up" && typeof params.registration_id === "string");
  const eventId = event.event_id;
  const storageKey = `proshnolab:meta:${pixelId}:${eventId}`;
  if (persistent) {
    if (sent.has(eventId)) return;
    try { if (localStorage.getItem(storageKey)) return; } catch { /* storage may be blocked */ }
  }
  try { if (!initMetaPixel()) return; } catch { return; }

  try {
    window.fbq!(isStandardMetaEvent(name) ? "trackSingle" : "trackSingleCustom", pixelId, event.event_name, event.custom_data, { eventID: eventId });
    if (persistent) {
      sent.add(eventId);
      try { localStorage.setItem(storageKey, String(Date.now())); } catch { /* in-memory dedup remains */ }
    }
  } catch { /* Analytics must never interrupt checkout or authentication. */ }
}
