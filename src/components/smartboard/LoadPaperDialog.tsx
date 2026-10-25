import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { SmartBoardPaperMeta, SmartBoardQuestion } from "./QuestionSlide";

export interface LoadedPaper {
  id?: string;
  questions: SmartBoardQuestion[];
  meta: SmartBoardPaperMeta | null;
  title: string;
}

interface LoadPaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (paper: LoadedPaper) => void;
}

interface SavedPaperSummary {
  id: string;
  exam_name: string | null;
  class_name: string | null;
  subject_name: string | null;
  chapter_names: string[] | null;
  question_ids: number[] | null;
  created_at: string;
}

const toBanglaNum = (value: number): string => {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value)
    .split("")
    .map((digit) => digits[Number(digit)] ?? digit)
    .join("");
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${toBanglaNum(date.getDate())}/${toBanglaNum(date.getMonth() + 1)}/${toBanglaNum(date.getFullYear())}`;
};

function readSessionPaper(): { questions: SmartBoardQuestion[]; meta: SmartBoardPaperMeta | null } | null {
  try {
    const rawQuestions = sessionStorage.getItem("viewPaperQuestions");
    const rawMeta = sessionStorage.getItem("viewPaperMeta");
    if (!rawQuestions) return null;
    const questions = JSON.parse(rawQuestions);
    if (!Array.isArray(questions) || questions.length === 0) return null;
    return {
      questions: questions as SmartBoardQuestion[],
      meta: rawMeta ? (JSON.parse(rawMeta) as SmartBoardPaperMeta) : null,
    };
  } catch {
    return null;
  }
}

export default function LoadPaperDialog({ open, onOpenChange, onLoad }: LoadPaperDialogProps) {
  const { user } = useAuth();
  const [papers, setPapers] = useState<SavedPaperSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [sessionPaper, setSessionPaper] = useState<{ questions: SmartBoardQuestion[]; meta: SmartBoardPaperMeta | null } | null>(null);

  const fetchPapers = useCallback(async () => {
    if (!user) {
      setPapers([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_papers")
      .select("id, exam_name, class_name, subject_name, chapter_names, question_ids, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("সংরক্ষিত প্রশ্নপত্র আনতে সমস্যা হয়েছে");
      setPapers([]);
    } else {
      setPapers((data as SavedPaperSummary[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    setSessionPaper(readSessionPaper());
    fetchPapers();
  }, [fetchPapers, open]);

  const handleLoadSessionPaper = () => {
    const paper = readSessionPaper();
    if (!paper) {
      toast.error("বর্তমানে তৈরি করা কোনো প্রশ্নপত্র পাওয়া যায়নি");
      return;
    }
    onLoad({ questions: paper.questions, meta: paper.meta, title: paper.meta?.programName || "বর্তমান প্রশ্নপত্র" });
    onOpenChange(false);
  };

  const handleLoadSavedPaper = async (paper: SavedPaperSummary) => {
    setLoadingId(paper.id);
    try {
      const { data, error } = await supabase.from("saved_papers").select("*").eq("id", paper.id).maybeSingle();
      if (error || !data) throw error || new Error("missing paper");

      const ids = (data.question_ids as number[]) || [];
      let questions: SmartBoardQuestion[] = [];
      if (ids.length > 0) {
        const { data: rows } = await supabase.from("questions").select("*").in("id", ids);
        const byId = new Map<number, SmartBoardQuestion>((rows || []).map((row: any) => [row.id as number, row as SmartBoardQuestion]));
        questions = ids.map((id) => byId.get(id)).filter(Boolean) as SmartBoardQuestion[];
      }

      if (questions.length === 0) {
        toast.error("এই প্রশ্নপত্রে কোনো প্রশ্ন পাওয়া যায়নি");
        return;
      }

      onLoad({
        id: data.id,
        questions,
        meta: {
          ...((data.meta as SmartBoardPaperMeta) || {}),
          instituteName: (data.meta as SmartBoardPaperMeta | null)?.instituteName || data.institution_name || undefined,
          className: (data.meta as SmartBoardPaperMeta | null)?.className || data.class_name || undefined,
          subjectName: (data.meta as SmartBoardPaperMeta | null)?.subjectName || data.subject_name || undefined,
          chapterNames: (data.meta as SmartBoardPaperMeta | null)?.chapterNames || data.chapter_names || undefined,
          programName: (data.meta as SmartBoardPaperMeta | null)?.programName || data.exam_name || undefined,
        },
        title: data.exam_name || data.subject_name || "প্রশ্নপত্র",
      });
      onOpenChange(false);
    } catch {
      toast.error("প্রশ্নপত্র লোড করা যায়নি");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[1px] border border-slate-300 bg-white shadow-lg p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold text-slate-900">প্রশ্নপত্র লোড করুন</DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            ক্লাউড ব্যাকআপে সংরক্ষিত প্রশ্নপত্র অথবা এই সেশনে তৈরি করা সর্বশেষ প্রশ্নপত্র স্মার্টবোর্ডে দেখুন।
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-2">এই সেশনের প্রশ্নপত্র</h3>
            <div className="rounded-[1px] border border-slate-300 bg-slate-50/70 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-800">
                    {sessionPaper ? sessionPaper.meta?.programName || "বর্তমান প্রশ্নপত্র" : "কোনো প্রশ্নপত্র তৈরি করা হয়নি"}
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {sessionPaper
                      ? `${toBanglaNum(sessionPaper.questions.length)}টি প্রশ্ন অন্তর্ভুক্ত আছে`
                      : "প্রশ্ন তৈরি করে আবার এখানে আসুন"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!sessionPaper}
                  onClick={handleLoadSessionPaper}
                  className="rounded-[1px] border-slate-300 hover:bg-emerald-600 hover:text-white text-slate-800 font-bold h-9 px-4 text-sm"
                >
                  লোড করুন
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-700">ক্লাউড ব্যাকআপ</h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[1px] px-2.5"
                onClick={fetchPapers}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                রিফ্রেশ
              </Button>
            </div>

            <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
              {loading && papers.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-600" />
                  লোড হচ্ছে...
                </div>
              ) : papers.length === 0 ? (
                <div className="rounded-[1px] border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 bg-slate-50/50">
                  সংরক্ষিত কোনো প্রশ্নপত্র পাওয়া যায়নি
                </div>
              ) : (
                papers.map((paper) => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => handleLoadSavedPaper(paper)}
                    disabled={loadingId !== null}
                    className="flex w-full items-start gap-3 rounded-[1px] border border-slate-300 p-3 text-left transition-colors bg-white hover:border-emerald-600 hover:bg-emerald-50/40 disabled:opacity-60 cursor-pointer"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-slate-900">
                        {paper.exam_name || paper.subject_name || "প্রশ্নপত্র"}
                      </p>
                      <p className="truncate text-sm text-slate-600 mt-0.5">
                        {[paper.class_name, paper.subject_name, (paper.chapter_names || []).join(", ")]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {toBanglaNum(paper.question_ids?.length || 0)}টি প্রশ্ন • {formatDate(paper.created_at)}
                      </p>
                    </div>
                    {loadingId === paper.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" /> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
