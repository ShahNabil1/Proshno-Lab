import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Eye, Download, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MessengerIcon from "@/components/icons/MessengerIcon";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import LatexRenderer from "@/components/LatexRenderer";
import { hasActiveAccess } from "@/lib/subscriptionMatcher";

const toBanglaNum = (n: number) => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[+d]);
const banglaOption = ["ক", "খ", "গ", "ঘ"];

type Suggestion = {
  id: number;
  title: string;
  description: string;
  class_id: number;
  subject_id: number;
  question_ids: number[];
};

type Question = {
  id: number;
  question: string;
  type: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: string | null;
  creative_data?: any;
  explanation?: string | null;
};

export default function Packages() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  // Preview state
  const [previewSuggestion, setPreviewSuggestion] = useState<Suggestion | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchSuggestions();
  }, [user]);

  const fetchSuggestions = async () => {
    if (!user) return;
    setLoading(true);

    // Get user's active subscription plans
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("plan, status, ends_at")
      .eq("teacher_id", user.id)
      .eq("status", "active");

    const activePlans = (subs || [])
      .filter(s => !s.ends_at || new Date(s.ends_at) > new Date())
      .map(s => s.plan);

    if (activePlans.length === 0) {
      setHasSubscription(false);
      setLoading(false);
      return;
    }
    setHasSubscription(true);

    // Get all packages, then filter via shared matcher (covers bundles, "সকল বিষয়", ranges)
    const { data: allPkgs } = await supabase
      .from("pricing_packages")
      .select("id, class_name, subject_name")
      .eq("is_active", true);

    const matchedPkgIds = (allPkgs || [])
      .filter(pkg => hasActiveAccess(activePlans, pkg.class_name, pkg.subject_name))
      .map(p => p.id);

    if (matchedPkgIds.length === 0) {
      setLoading(false);
      return;
    }

    // Get suggestion assignments for those packages
    const { data: asgData } = await supabase
      .from("suggestion_assignments")
      .select("suggestion_id")
      .in("package_id", matchedPkgIds);

    const suggestionIds = [...new Set((asgData || []).map(a => a.suggestion_id))];

    if (suggestionIds.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch suggestions
    const { data: sugData } = await supabase
      .from("suggestions")
      .select("*")
      .in("id", suggestionIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setSuggestions((sugData as any[]) || []);
    setLoading(false);
  };

  const openPreview = async (s: Suggestion) => {
    setPreviewSuggestion(s);
    setPreviewLoading(true);
    if (s.question_ids.length > 0) {
      const { data } = await supabase
        .from("questions")
        .select("id, question, type, option_a, option_b, option_c, option_d, correct_answer, creative_data, explanation")
        .in("id", s.question_ids);

      // Sort by the order in question_ids
      const ordered = s.question_ids
        .map(id => (data || []).find(q => q.id === id))
        .filter(Boolean) as Question[];
      setPreviewQuestions(ordered);
    }
    setPreviewLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="text-center py-10 text-muted-foreground">লোড হচ্ছে...</div>;

  if (!hasSubscription) {
    return (
      <Card className="max-w-md mx-auto mt-10">
        <CardContent className="p-8 text-center">
          <Lock className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="font-heading font-bold text-lg text-destructive mb-2">
            কোনো রেডি প্রশ্ন/সাজেশন প্যাকেজ নেই
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            প্যাকেজ ক্রয় করুন, অথবা ক্রয় করার পরেও এই মেসেজ দেখে থাকলে আমাদের মেসেজ দিন
          </p>
          <Button variant="outline" className="gap-2" asChild>
            <a href="https://m.me/proshnolab" target="_blank" rel="noopener noreferrer">
              <MessengerIcon className="w-4 h-4" /> Messenger
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-center mb-6">রেডি প্রশ্ন/সাজেশন</h1>

      {suggestions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">আপনার প্যাকেজে এখনো কোনো সাজেশন অ্যাসাইন হয়নি।</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map(s => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-2">
                  <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-sm line-clamp-2">{s.title}</h3>
                    {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{toBanglaNum(s.question_ids.length)} টি প্রশ্ন</Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openPreview(s)}>
                    <Eye className="w-3.5 h-3.5" /> প্রিভিউ
                  </Button>
                  <Button size="sm" className="flex-1 gap-1" onClick={() => { openPreview(s); setTimeout(handlePrint, 500); }}>
                    <Download className="w-3.5 h-3.5" /> ডাউনলোড
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewSuggestion} onOpenChange={open => { if (!open) setPreviewSuggestion(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
          <DialogHeader className="print:hidden">
            <DialogTitle className="font-heading">{previewSuggestion?.title}</DialogTitle>
          </DialogHeader>

          {/* Print header */}
          <div className="hidden print:block text-center mb-6" style={{ fontFamily: "'SolaimanLipi', serif" }}>
            <h1 className="text-xl font-bold">Proshno Lab সাজেশন</h1>
            <h2 className="text-lg font-semibold mt-1">{previewSuggestion?.title}</h2>
          </div>

          {previewLoading ? (
            <p className="text-center py-4 text-muted-foreground">লোড হচ্ছে...</p>
          ) : (
            <SuggestionPreview questions={previewQuestions} />
          )}

          <div className="flex justify-end gap-2 mt-4 print:hidden">
            <Button onClick={handlePrint} className="gap-1"><Download className="w-4 h-4" /> প্রিন্ট / PDF</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SuggestionPreview({ questions }: { questions: Question[] }) {
  const mcqs = questions.filter(q => q.type === "mcq");
  const shorts = questions.filter(q => q.type === "short");
  const creatives = questions.filter(q => q.type === "creative");
  const descriptives = questions.filter(q => q.type === "descriptive");

  let serial = 0;

  return (
    <div className="space-y-6 text-sm" style={{ fontFamily: "'SolaimanLipi', serif" }}>
      {/* MCQ Section */}
      {mcqs.length > 0 && (
        <div>
          <h3 className="font-bold text-base mb-2 border-b pb-1">বহুনির্বাচনী প্রশ্ন (প্রতিটি ১ নম্বর) — মোট {toBanglaNum(mcqs.length)} x ১ = {toBanglaNum(mcqs.length)}</h3>
          <p className="text-xs text-muted-foreground mb-3">সবগুলো প্রশ্নের উত্তর দাও।</p>
          <div className="space-y-3">
            {mcqs.map(q => {
              serial++;
              return (
                <div key={q.id}>
                  <div className="flex gap-2">
                    <span className="font-bold shrink-0 w-[2.2rem] text-right">{toBanglaNum(serial)}.</span>
                    <div className="flex-1">
                      <LatexRenderer text={q.question} />
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 pl-0">
                        {["a", "b", "c", "d"].map((opt, i) => {
                          const val = q[`option_${opt}` as keyof Question] as string;
                          if (!val) return null;
                          return (
                            <span key={opt} className="text-sm">
                              {banglaOption[i]}. <LatexRenderer text={val} />
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Short Section */}
      {shorts.length > 0 && (
        <div>
          <h3 className="font-bold text-base mb-2 border-b pb-1">সংক্ষিপ্ত প্রশ্ন (প্রতিটি ২ নম্বর) — মোট {toBanglaNum(shorts.length)} x ২ = {toBanglaNum(shorts.length * 2)}</h3>
          <div className="space-y-2">
            {shorts.map(q => {
              serial++;
              return (
                <div key={q.id} className="flex gap-2">
                  <span className="font-bold shrink-0 w-[2.2rem] text-right">{toBanglaNum(serial)}.</span>
                  <div className="flex-1"><LatexRenderer text={q.question} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Creative Section */}
      {creatives.length > 0 && (
        <div>
          <h3 className="font-bold text-base mb-2 border-b pb-1">সৃজনশীল প্রশ্ন (প্রতিটি ১০ নম্বর) — মোট {toBanglaNum(creatives.length)} x ১০ = {toBanglaNum(creatives.length * 10)}</h3>
          <div className="space-y-4">
            {creatives.map(q => {
              serial++;
              const parts = Array.isArray(q.creative_data) ? q.creative_data : (q.creative_data as any)?.parts || [];
              return (
                <div key={q.id}>
                  <div className="flex gap-2">
                    <span className="font-bold shrink-0 w-[2.2rem] text-right">{toBanglaNum(serial)}.</span>
                    <div className="flex-1">
                      <LatexRenderer text={q.question} />
                      {parts.length > 0 && (
                        <div className="mt-1.5 space-y-0.5 pl-2">
                          {parts.map((p: any, i: number) => (
                            <div key={i} className="flex gap-2">
                              <span className="shrink-0">{banglaOption[i]})</span>
                              <span className="flex-1"><LatexRenderer text={p.question || p.text || ""} /></span>
                              <span className="text-muted-foreground shrink-0">{toBanglaNum(p.marks || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Descriptive Section */}
      {descriptives.length > 0 && (
        <div>
          <h3 className="font-bold text-base mb-2 border-b pb-1">বর্ণনামূলক প্রশ্ন (প্রতিটি ১০ নম্বর) — মোট {toBanglaNum(descriptives.length)} x ১০ = {toBanglaNum(descriptives.length * 10)}</h3>
          <div className="space-y-4">
            {descriptives.map(q => {
              serial++;
              const parts = Array.isArray(q.creative_data) ? q.creative_data : (q.creative_data as any)?.parts || [];
              return (
                <div key={q.id}>
                  <div className="flex gap-2">
                    <span className="font-bold shrink-0 w-[2.2rem] text-right">{toBanglaNum(serial)}.</span>
                    <div className="flex-1">
                      <LatexRenderer text={q.question} />
                      {parts.length > 0 && (
                        <div className="mt-1.5 space-y-0.5 pl-2">
                          {parts.map((p: any, i: number) => (
                            <div key={i} className="flex gap-2">
                              <span className="shrink-0">{banglaOption[i]})</span>
                              <span className="flex-1"><LatexRenderer text={p.question || p.text || ""} /></span>
                              <span className="text-muted-foreground shrink-0">{toBanglaNum(p.marks || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
