import { useSyncExternalStore } from "react";
const key = (userId?: string) => `proshnolab:no-package-preview:${userId || ""}`;
export const isNoPackagePreview = (userId?: string) => !!userId && sessionStorage.getItem(key(userId)) === "1";
export function setNoPackagePreview(userId: string, enabled: boolean) {
  if (enabled) sessionStorage.setItem(key(userId), "1");
  else sessionStorage.removeItem(key(userId));
  window.dispatchEvent(new Event("admin-experience-preview"));
}
export function useNoPackagePreview(userId?: string) {
  return useSyncExternalStore(
    listener => { window.addEventListener("admin-experience-preview", listener); return () => window.removeEventListener("admin-experience-preview", listener); },
    () => isNoPackagePreview(userId), () => false,
  );
}
