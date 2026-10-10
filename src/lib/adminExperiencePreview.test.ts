import { afterEach, expect, it } from "vitest";
import { isNoPackagePreview, setNoPackagePreview } from "./adminExperiencePreview";
afterEach(() => sessionStorage.clear());
it("keeps the preview scoped to its account and restores normal access when stopped", () => {
  expect(isNoPackagePreview("admin-a")).toBe(false);
  setNoPackagePreview("admin-a", true);
  expect(isNoPackagePreview("admin-a")).toBe(true);
  expect(isNoPackagePreview("teacher-b")).toBe(false);
  expect(isNoPackagePreview()).toBe(false);
  setNoPackagePreview("admin-a", false);
  expect(isNoPackagePreview("admin-a")).toBe(false);
});
