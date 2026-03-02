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
async function sendServerEvent(eventName: string, params: Record<string, any> = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke("track-event", {
      body: {
        event_name: eventName,
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
  pushEvent(eventName, params);
  sendServerEvent(eventName, params);
}

// Pre-built event helpers
export const analytics = {
  pageView: (pagePath: string, pageTitle: string) =>
    trackEvent("page_view", { page_path: pagePath, page_title: pageTitle }),

  login: (method: string) =>
    trackEvent("login", { method }),

  signUp: (method: string) =>
    trackEvent("sign_up", { method }),

  viewItem: (itemId: string, itemName: string, category: string) =>
    trackEvent("view_item", { item_id: itemId, item_name: itemName, item_category: category }),

  beginCheckout: (value: number, currency = "BDT") =>
    trackEvent("begin_checkout", { value, currency }),

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
