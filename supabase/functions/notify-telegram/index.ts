import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createNotificationHandler } from "../_shared/notificationHandler.ts";
import { deliverPaymentTelegram } from "../_shared/paymentTelegram.ts";

const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, key);
Deno.serve(createNotificationHandler({
  serviceKey: key,
  async getUser(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user;
  },
  async claim(actor, event, record) {
    const { data, error } = await admin.rpc("claim_user_telegram_notification", {
      actor, event, record_ref: record,
    });
    if (error) throw Error("Notification claim failed");
    return data;
  },
  async deliver(text, claim) {
    const chats = [...new Set((Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") || "").split(",").map(s => s.trim()).filter(Boolean))];
    const config = { lovableKey: Deno.env.get("LOVABLE_API_KEY") || "", telegramKey: Deno.env.get("TELEGRAM_API_KEY") || "" };
    if (!chats.length || !config.lovableKey || !config.telegramKey) throw Error("Telegram unavailable");
    for (const chat of chats) {
      if (claim?.delivered_chat_ids?.includes(chat)) continue;
      if (!await deliverPaymentTelegram(text, chat, config)) throw Error("Delivery failed");
      if (claim) {
        const { error } = await admin.rpc("record_user_telegram_delivery", {
          notification_ref: claim.id, lease: claim.lease_token, chat,
        });
        if (error) throw Error("Delivery receipt unavailable");
      }
    }
    if (claim) {
      const { error } = await admin.rpc("finish_user_telegram_notification", {
        notification_ref: claim.id, lease: claim.lease_token,
      });
      if (error) throw Error("Delivery completion unavailable");
    }
  },
}));
