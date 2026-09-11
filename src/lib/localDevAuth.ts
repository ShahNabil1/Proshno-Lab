import type { User } from "@supabase/supabase-js";

const LOCAL_MOCK_ADMIN_KEY = "proshnolab.localMockAdmin.v1";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export const isLocalDevelopment = (): boolean =>
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  LOCAL_HOSTS.has(window.location.hostname);

export const isLocalMockAdminEnabled = (): boolean =>
  isLocalDevelopment() && localStorage.getItem(LOCAL_MOCK_ADMIN_KEY) === "1";

export const enableLocalMockAdmin = (): void => {
  if (!isLocalDevelopment()) return;
  localStorage.setItem(LOCAL_MOCK_ADMIN_KEY, "1");
};

export const disableLocalMockAdmin = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_MOCK_ADMIN_KEY);
};

export const createLocalMockAdmin = (): User => ({
  id: "00000000-0000-4000-8000-000000000001",
  app_metadata: { provider: "local-dev", providers: ["local-dev"] },
  user_metadata: { full_name: "Local Test Admin" },
  aud: "authenticated",
  created_at: new Date(0).toISOString(),
} as User);

