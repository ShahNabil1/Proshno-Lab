import { describe, expect, it } from "vitest";
import { paymentError } from "./paymentError";

describe("payment errors", () => {
  it("explains an owned subject rejection and keeps the response readable", async () => {
    const context = new Response(JSON.stringify({ error: "You already own selected subjects. Remove them before purchasing." }), { status: 409 });
    expect((await paymentError({ context })).message).toContain("আগে থেকেই সক্রিয়");
    expect((await context.json()).error).toContain("already own");
  });
  it("does not expose gateway or credential details", async () => {
    const context = new Response(JSON.stringify({ error: "Token grant failed: private-token", details: "private-data" }), { status: 502 });
    expect((await paymentError({ context })).message).not.toMatch(/private|Token/);
  });
  it("handles an expired session and a non-JSON failure", async () => {
    expect((await paymentError({ context: new Response("Unauthorized", { status: 401 }) })).message).toContain("লগইন");
    expect((await paymentError({ context: new Response("bad gateway", { status: 502 }) })).message).toContain("পেমেন্ট সেবা");
  });
});
