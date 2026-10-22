import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, afterEach } from "vitest";
import PaymentCallback from "./PaymentCallback";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: mocks.invoke },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
} }));
vi.mock("@/lib/analytics", () => ({ analytics: { purchase: vi.fn() }, trackEvent: vi.fn() }));
vi.mock("@/lib/marketingContext", () => ({ getMarketingContext: () => ({}) }));
describe("payment access recovery", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it.each(["cancel", "failure"])("reports %s through an authenticated query-only server call", async (status) => {
    mocks.invoke.mockResolvedValueOnce({ data: { status: "initiated" }, error: null });
    render(<MemoryRouter initialEntries={[`/payment/callback?paymentID=unpaid&status=${status}`]}><PaymentCallback /></MemoryRouter>);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("bkash-execute-payment", { body: { paymentID: "unpaid", verifyOnly: true } }));
  });
  it("shows verified success even when the callback URL says cancelled", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { status: "completed", trxID: "settled" }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { status: "completed", amount: 500, trx_id: "settled" }, error: null });
    render(<MemoryRouter initialEntries={["/payment/callback?paymentID=paid&status=cancel"]}><PaymentCallback /></MemoryRouter>);
    await screen.findByRole("heading", { name: /সফল/  });
  });
  it("shows pending activation and re-verifies the existing completed payment without a new checkout", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ status: "activation_pending" }) } } })
      .mockResolvedValueOnce({ data: { status: "completed", trxID: "verified" }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { status: "completed", amount: 500, trx_id: "verified", selected_packages: [{ id: 1 }] }, error: null });
    render(<MemoryRouter initialEntries={["/payment/callback?paymentID=paid&status=success"]}><Routes>
      <Route path="/payment/callback" element={<PaymentCallback />} />
      <Route path="/dashboard/subscription" element={<p>Verified access</p>} />
    </Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("heading").textContent).toBe("\u0985\u09cd\u09af\u09be\u0995\u09cd\u09b8\u09c7\u09b8 \u099a\u09be\u09b2\u09c1 \u09b9\u099a\u09cd\u099b\u09c7"));
    fireEvent.click(screen.getAllByRole("button")[0]);
    await screen.findByText("Verified access");
    expect(mocks.invoke.mock.calls.map(call => call[0])).toEqual(["bkash-execute-payment", "bkash-execute-payment"]);
  });
});
