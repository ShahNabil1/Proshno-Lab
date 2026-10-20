import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PackageVersion = "bangla" | "english";
export interface BuilderConfig {
  class_id: number;
  version: PackageVersion;
  class_level: string;
  all_package_id: number;
  normal_price: number;
  special_price: number;
  caps: Record<string, number>;
  groups: string[];
  is_active: boolean;
  sort_order: number;
}
export interface BuilderSubject {
  subject_id: number;
  class_id: number;
  name: string;
  price: number;
  individual_price: number | null;
  is_special: boolean;
  groups: string[];
  is_active: boolean;
  sort_order: number;
}
export interface BuilderClass extends BuilderConfig {
  name: string;
  all_price: number;
  subjects: BuilderSubject[];
}
export interface CustomSelection {
  version: PackageVersion;
  class_id: number;
  group: string | null;
  subject_ids: number[];
}
export interface CustomQuote extends CustomSelection {
  kind: "custom";
  class_name: string;
  subject_name: string;
  regular_total: number;
  price: number;
  savings: number;
  all_price: number;
  all_package_id: number;
  upgrade_difference: number;
  owned_subject_ids: number[];
  duration_days: number;
}

export type SubjectPricing = Pick<BuilderSubject, "subject_id" | "individual_price" | "is_special" | "groups" | "is_active" | "sort_order">;
type ConfigTable<T> = { Row: T & Record<string, unknown>; Insert: T & Record<string, unknown>; Update: Partial<T> & Record<string, unknown>; Relationships: [] };
type BuilderDatabase = { public: {
  Tables: { custom_package_pricing: ConfigTable<BuilderConfig>; custom_package_subjects: ConfigTable<SubjectPricing> };
  Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never>;
} };
export const builderAdminClient = supabase as unknown as SupabaseClient<BuilderDatabase>;

// Keep the handwritten RPC boundary here until Supabase types are regenerated.
type BuilderRpc = {
  custom_package_owned_subjects: { args: { selected_class: number }; result: number[] };
  custom_package_catalog: { args: Record<string, never>; result: BuilderClass[] };
  quote_custom_package: { args: { selection: Json }; result: CustomQuote };
};
export async function builderRpc<K extends keyof BuilderRpc>(name: K, args: BuilderRpc[K]["args"]): Promise<BuilderRpc[K]["result"]> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: unknown) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return data as BuilderRpc[K]["result"];
}

export const defaultPricing = (level: string) => ({
  normal_price: 199,
  special_price: 199,
  caps: ["6", "7", "8"].includes(level)
    ? { "2": 549, "3": 749, "4": 899 }
    : level === "9-10"
      ? { "2": 849, "3": 1099, "4": 1249, "5": 1349, "6": 1399 }
      : { "2": 849, "3": 1099, "4": 1349, "5": 1549, "6": 1699, "7": 1799 },
});

export function validSubjects(subjects: BuilderSubject[], group: string | null) {
  return subjects.filter(s => s.is_active && (!s.groups.length || (group !== null && s.groups.includes(group))));
}
