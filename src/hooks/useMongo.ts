import { supabase } from "@/integrations/supabase/client";

const DB = "eexamapp";

interface MongoRequest {
  action: string;
  collection: string;
  database?: string;
  filter?: Record<string, unknown>;
  document?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
  update?: Record<string, unknown>;
  pipeline?: Record<string, unknown>[];
  sort?: Record<string, unknown>;
  limit?: number;
  skip?: number;
}

export async function mongoQuery(params: Omit<MongoRequest, "database">) {
  const { data, error } = await supabase.functions.invoke("mongodb", {
    body: { ...params, database: DB },
  });
  if (error) throw error;
  return data;
}
