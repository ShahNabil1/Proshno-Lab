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

const standard: Record<string, string> = {
  page_view: "PageView", sign_up: "CompleteRegistration", view_item: "ViewContent",
  add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout",
  add_payment_info: "AddPaymentInfo", purchase: "Purchase", search: "Search", contact: "Contact",
};
const custom: Record<string, string> = {
  login: "Login", paper_generate: "PaperGenerated", question_create: "QuestionCreated",
  download: "PaperDownloaded", print: "PaperPrinted", button_click: "ButtonClick",
  print_requested: "PrintRequested", payment_failed: "PaymentFailed", payment_cancelled: "PaymentCancelled",
};

export function trackMetaEvent(name: string, params: Params = {}): void {
  // Do not market internal admin activity or authentication callback pages.
  if (/^\/(admin(?:\/|$)|auth\/callback|reset-password)/.test(window.location.pathname)) return;
  const mapped = standard[name] || custom[name];
  if (!mapped) return;
  const transaction = typeof params.transaction_id === "string" ? params.transaction_id : "";
  if (name === "purchase" && (!transaction || !Number.isFinite(params.value) || Number(params.value) < 0)) return;
  const registration = typeof params.registration_id === "string" ? params.registration_id : "";
  const persistent = name === "purchase" || (name === "sign_up" && !!registration);
  const eventId = name === "purchase" ? `purchase:${transaction}`
    : name === "sign_up" && registration ? `registration:${registration}` : crypto.randomUUID();
  const storageKey = `proshnolab:meta:${pixelId}:${eventId}`;
  if (persistent) {
    if (sent.has(eventId)) return;
    try { if (localStorage.getItem(storageKey)) return; } catch { /* storage may be blocked */ }
  }
  try { if (!initMetaPixel()) return; } catch { return; }

  // Allowlist business metadata. Never copy form fields, email, phone, or tokens.
  const payload: Params = {};
  for (const key of ["value", "currency", "content_name", "content_category", "content_ids", "contents", "num_items", "method", "question_type", "class_id", "subject_id", "channel", "format", "button_name", "location"]) {
    if (params[key] !== undefined) payload[key] = params[key];
  }
  if (params.item_id !== undefined) { payload.content_ids = [String(params.item_id)]; payload.content_type = "product"; }
  if (params.item_name !== undefined) payload.content_name = params.item_name;
  if (params.item_category !== undefined) payload.content_category = params.item_category;
  if (name === "sign_up") payload.status = true;
  if (name === "search") payload.search_string = params.search_term;
  try {
    window.fbq!(standard[name] ? "trackSingle" : "trackSingleCustom", pixelId, mapped, payload, { eventID: eventId });
    if (persistent) {
      sent.add(eventId);
      try { localStorage.setItem(storageKey, String(Date.now())); } catch { /* in-memory dedup remains */ }
    }
  } catch { /* Analytics must never interrupt checkout or authentication. */ }
}
