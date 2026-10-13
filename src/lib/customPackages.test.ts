import { describe, expect, it, vi } from "vitest";
import { builderRpc } from "./customPackages";

vi.mock("@/integrations/supabase/client", () => {
  const client = { rpc: async function(this: unknown) {
    if (this !== client) throw new Error("RPC must retain its client binding");
    return { data: [], error: null };
  } };
  return { supabase: client };
});

describe("builder RPC boundary", () => {
  it("calls the Supabase method with its client binding", async () => {
    expect(await builderRpc("custom_package_catalog", {})).toEqual([]);
  });
});
