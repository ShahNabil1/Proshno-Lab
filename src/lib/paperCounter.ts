import { supabase } from "@/integrations/supabase/client";

/**
 * Dashboard stats for generated question papers.
 *
 * Only two running totals live on the teacher row (generated_sets /
 * generated_questions); the generated paper itself is never stored, so this
 * costs practically no database space. A device-local mirror keeps the
 * dashboard counting even before the record_generated_paper migration is
 * applied.
 */

const LOCAL_KEY = "proshno-lab:generated-paper-stats";

export type GeneratedPaperStats = { sets: number; questions: number };

function localKeyFor(userKey: string) {
  return `${LOCAL_KEY}:${userKey}`;
}

function readLocal(userKey: string): GeneratedPaperStats {
  try {
    const raw = localStorage.getItem(localKeyFor(userKey));
    if (!raw) return { sets: 0, questions: 0 };
    const parsed = JSON.parse(raw) as Partial<GeneratedPaperStats>;
    return { sets: Number(parsed.sets) || 0, questions: Number(parsed.questions) || 0 };
  } catch {
    return { sets: 0, questions: 0 };
  }
}

function writeLocal(userKey: string, stats: GeneratedPaperStats) {
  try {
    localStorage.setItem(localKeyFor(userKey), JSON.stringify(stats));
  } catch {
    // storage unavailable - the database counter stays the source of truth
  }
}

async function currentUserKey(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id || "anonymous";
  } catch {
    return "anonymous";
  }
}

export async function readLocalGeneratedStats(): Promise<GeneratedPaperStats> {
  return readLocal(await currentUserKey());
}

export async function recordGeneratedPaper(questionCount: number) {
  const added = Math.max(0, Math.trunc(questionCount) || 0);

  const userKey = await currentUserKey();
  const local = readLocal(userKey);
  writeLocal(userKey, { sets: local.sets + 1, questions: local.questions + added });

  try {
    const { error } = await (supabase as any).rpc("record_generated_paper", {
      q_count: added,
    });
    return !error;
  } catch {
    return false;
  }
}