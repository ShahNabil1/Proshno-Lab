import { render, screen, within, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ReadyPackageCatalog from "./ReadyPackageCatalog";

vi.mock("@/lib/customPackages", () => ({
  builderRpc: vi.fn(async () => [
    { name: "ষষ্ঠ শ্রেণি", version: "bangla", normal_price: 299 },
    { name: "একাদশ-দ্বাদশ", version: "bangla", normal_price: 449 },
  ]),
}));
afterEach(cleanup);

it("shows authoritative subject prices instead of the obsolete 249 taka fallback", async () => {
  render(<ReadyPackageCatalog packages={[]} selected={new Set()} onSelect={vi.fn()} />);
  const teacherTable = screen.getAllByRole("table")[0];
  const sixth = within(teacherTable).getByRole("row", { name: /ষষ্ঠ/ });
  const higher = within(teacherTable).getByRole("row", { name: /একাদশ/ });
  await waitFor(() => expect(within(sixth).getByText("২৯৯/-")).toBeVisible());
  expect(within(higher).getByText("৪৪৯/-")).toBeVisible();
  expect(within(sixth).queryByText("২৪৯/-")).toBeNull();
});
