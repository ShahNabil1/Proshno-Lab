// Both checkout callbacks and administrative reconciliation use the same transaction.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
export async function activateFixedPayment(admin: SupabaseClient, payment: { id: number; payment_id: string; amount: number }, receipt: any) {
  if (receipt?.transactionStatus !== "Completed" || !receipt?.trxID || receipt.paymentID !== payment.payment_id || receipt.currency !== "BDT" || Number(receipt.amount) !== Number(payment.amount)) return { ok: false, verificationRequired: true };
  const { error } = await admin.rpc("complete_fixed_payment", { payment_ref: payment.id, receipt });
  if (!error) return { ok: true };
  // Preserve settled money as recoverable. Never claim successful activation.
  const { error: saveError } = await admin.from("bkash_payments").update({ bkash_response: receipt, trx_id: receipt.trxID, error_message: "Access activation pending: " + error.message }).eq("id", payment.id);
  if (saveError) console.error("payment_receipt_save_failed", payment.id);
  return { ok: false, activationPending: true };
}
