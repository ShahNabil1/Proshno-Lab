export class CheckoutRecoveryError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}

/** Only server-queried unpaid attempts may stop blocking a new checkout.
 * Keep their receipts intact: an older callback may still need reconciliation.
 */
export async function recoverCustomCheckout(admin: any, buyer: string, order: any,
  amount: number, coupon: string | null, environment: string,
  queryGateway: (paymentID: string) => Promise<any>, now = Date.now()) {
  const { data, error } = await admin.from("bkash_payments")
    .select("id,payment_id,selected_packages,amount,coupon_code,created_at,bkash_response,trx_id")
    .eq("user_id", buyer).eq("status", "initiated").eq("environment", environment)
    .order("id", { ascending: false }).limit(51);
  if (error || !Array.isArray(data) || data.length > 50) throw new CheckoutRecoveryError("PAYMENT_STATUS_UNAVAILABLE", 503);
  const wanted = new Set(order.subject_ids.map(Number));
  const verifiedUnpaidIds: number[] = [];
  let resume: { paymentID: string; bkashURL: string; amount: number } | undefined;
  for (const payment of data) {
    const item = payment.selected_packages?.find((p: any) => p.kind === "custom" && p.subject_ids?.some((id: any) => wanted.has(Number(id))));
    if (!item) continue;
    if (!payment.payment_id) {
      // A crashed create request must not reserve subjects forever. A recent
      // request is still protected by the transactional reservation below.
      if (now - Date.parse(payment.created_at) >= 5 * 60_000 && !payment.trx_id) verifiedUnpaidIds.push(payment.id);
      continue;
    }
    let receipt;
    try { receipt = await queryGateway(payment.payment_id); }
    catch { throw new CheckoutRecoveryError("PAYMENT_STATUS_UNAVAILABLE", 503); }
    if (receipt?.statusCode !== "0000" || receipt.paymentID !== payment.payment_id ||
        receipt.currency !== "BDT" || Number(receipt.amount) !== Number(payment.amount)) {
      throw new CheckoutRecoveryError("PAYMENT_STATUS_UNAVAILABLE", 503);
    }
    if (receipt.transactionStatus === "Completed") {
      const { error: activationError } = await admin.rpc("complete_custom_payment", { payment_ref: payment.id, receipt });
      if (activationError) {
        await admin.from("bkash_payments").update({ bkash_response: receipt, trx_id: receipt.trxID, error_message: "Access activation pending" })
          .eq("id", payment.id).eq("status", "initiated");
        throw new CheckoutRecoveryError("PAYMENT_ACTIVATION_PENDING", 503);
      }
      throw new CheckoutRecoveryError("PAYMENT_ALREADY_COMPLETED");
    }
    // A saved transaction ID or completed receipt takes precedence over a
    // contradictory response. Do not make the buyer pay a second time.
    if (payment.trx_id || payment.bkash_response?.transactionStatus === "Completed" ||
        !["Initiated", "Cancelled", "Failed", "Expired"].includes(receipt.transactionStatus)) {
      throw new CheckoutRecoveryError("PAYMENT_STATUS_UNAVAILABLE", 503);
    }
    const sameSubjects = item.subject_ids.length === wanted.size && item.subject_ids.every((id: any) => wanted.has(Number(id)));
    const recent = now - Date.parse(payment.created_at) < 30_000;
    if (receipt.transactionStatus === "Initiated" && recent) {
      if (sameSubjects && Number(payment.amount) === amount && (payment.coupon_code || null) === coupon &&
          typeof payment.bkash_response?.bkashURL === "string") {
        resume = { paymentID: payment.payment_id, bkashURL: payment.bkash_response.bkashURL, amount };
      } else throw new CheckoutRecoveryError("PAYMENT_CREATION_IN_PROGRESS");
    }
    verifiedUnpaidIds.push(payment.id);
  }
  return { verifiedUnpaidIds, resume };
}
