export type MetaParams = Record<string, unknown>;
export interface MetaEvent {
  event_name: string;
  event_id: string;
  custom_data: MetaParams;
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

export const isStandardMetaEvent = (name: string) => Boolean(standard[name]);

// One mapping for Pixel and CAPI. Never forward the whole checkout form.
export function createMetaEvent(name: string, params: MetaParams = {}, eventId?: string): MetaEvent | undefined {
  const mapped = standard[name] || custom[name];
  if (!mapped) return;
  const transaction = typeof params.transaction_id === "string" ? params.transaction_id : "";
  if (name === "purchase" && (!transaction || !Number.isFinite(params.value) || Number(params.value) < 0)) return;
  const registration = typeof params.registration_id === "string" ? params.registration_id : "";
  const id = name === "purchase" ? `purchase:${transaction}`
    : name === "sign_up" && registration ? `registration:${registration}` : eventId || crypto.randomUUID();
  const payload: MetaParams = {};
  for (const key of ["value", "currency", "content_name", "content_category", "num_items", "method", "question_type", "class_id", "subject_id", "channel", "format", "button_name", "location"]) {
    const value = params[key];
    if (typeof value === "string") payload[key] = value.slice(0, 200);
    else if (typeof value === "number" && Number.isFinite(value)) payload[key] = value;
  }
  if (Array.isArray(params.content_ids)) payload.content_ids = params.content_ids.slice(0, 50).map(String);
  if (params.item_id !== undefined) { payload.content_ids = [String(params.item_id).slice(0, 200)]; payload.content_type = "product"; }
  if (typeof params.item_name === "string") payload.content_name = params.item_name.slice(0, 200);
  if (typeof params.item_category === "string") payload.content_category = params.item_category.slice(0, 200);
  if (name === "sign_up") payload.status = true;
  if (name === "search" && typeof params.search_term === "string") payload.search_string = params.search_term.slice(0, 200);
  return { event_name: mapped, event_id: id, custom_data: payload };
}
