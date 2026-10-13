import { createMetaEvent, type MetaEvent } from "@/lib/metaEvents";
import { getMarketingContext, type MarketingContext } from "@/lib/marketingContext";
import { trackMetaEvent } from "@/lib/metaPixel";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

// Push event to GTM dataLayer
export function pushEvent(eventName: string, params: Record<string, any> = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });
}

// Send event to server-side tracking edge function
async function sendServerEvent(eventName: string, params: Record<string, any> = {}, meta?: MetaEvent, marketing?: MarketingContext) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke("track-event", {
      body: {
        event_name: eventName,
        event_id: meta?.event_id,
        marketing,
        user_id: session?.user?.id || null,
        params,
        timestamp: new Date().toISOString(),
        page_url: window.location.href,
        page_path: window.location.pathname,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      },
    });
  } catch (e) {
    // Silent fail - don't block UX for analytics
  }
}

// Track both client + server side
export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  const excluded = /^\/(admin(?:\/|$)|auth\/callback|reset-password)/.test(window.location.pathname);
  const meta = !excluded && import.meta.env.VITE_META_PIXEL_ENABLED !== "false" ? createMetaEvent(eventName, params) : undefined;
  const marketing = meta ? getMarketingContext() : undefined;
  pushEvent(eventName, { ...params, ...(meta ? { event_id: meta.event_id } : {}) });
  if (meta) trackMetaEvent(eventName, params, meta.event_id);
  void sendServerEvent(eventName, params, meta, marketing);
}

// Pre-built event helpers
export const analytics = {
  pageView: (pagePath: string, pageTitle: string) =>
    trackEvent("page_view", { page_path: pagePath, page_title: pageTitle }),

  login: (method: string) =>
    trackEvent("login", { method }),

  signUp: (method: string, registrationId?: string) =>
    trackEvent("sign_up", { method, registration_id: registrationId }),

  viewItem: (itemId: string, itemName: string, category: string) =>
    trackEvent("view_item", { item_id: itemId, item_name: itemName, item_category: category }),

  beginCheckout: (value: number, currency = "BDT") =>
    trackEvent("begin_checkout", { value, currency }),

  addToCart: (itemId: string, itemName: string, value: number) =>
    trackEvent("add_to_cart", { item_id: itemId, item_name: itemName, value, currency: "BDT" }),

  addPaymentInfo: (value: number) =>
    trackEvent("add_payment_info", { value, currency: "BDT", method: "bkash" }),

  purchase: (transactionId: string, value: number, currency = "BDT") =>
    trackEvent("purchase", { transaction_id: transactionId, value, currency }),

  questionCreate: (type: string, subjectId: number) =>
    trackEvent("question_create", { question_type: type, subject_id: subjectId }),

  paperGenerate: (classId: string, subjectId: string) =>
    trackEvent("paper_generate", { class_id: classId, subject_id: subjectId }),

  buttonClick: (buttonName: string, location: string) =>
    trackEvent("button_click", { button_name: buttonName, location }),

  search: (searchTerm: string) =>
    trackEvent("search", { search_term: searchTerm }),

  formSubmit: (formName: string) =>
    trackEvent("form_submit", { form_name: formName }),
};
